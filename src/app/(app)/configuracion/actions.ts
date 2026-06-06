"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/* ── Tipo de estado para useActionState ────────────────── */

export type FormState = { error?: string } | undefined;

/** Verifica que el usuario actual sea ADMINISTRADOR. Lanza si no lo es. */
async function requireAdmin() {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") {
    throw new Error("No autorizado.");
  }
  return user;
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos.";
}

/* ════════════════════════════════════════════════════════
 * USUARIOS
 * ════════════════════════════════════════════════════════ */

const rolEnum = z.enum(["ADMINISTRADOR", "COORDINADOR", "USUARIO"]);

const usuarioBaseSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  email: z.email("Correo electrónico inválido."),
  rol: rolEnum,
  activo: z.boolean(),
  sedeIds: z.array(z.string()).default([]),
});

/** Valida las reglas de asignación de sedes según el rol. */
function validarSedesPorRol(
  rol: z.infer<typeof rolEnum>,
  sedeIds: string[],
): string | null {
  if (rol === "ADMINISTRADOR") return null; // admin ve todas, no requiere asignación
  if (rol === "COORDINADOR") {
    if (sedeIds.length === 0) {
      return "El coordinador debe tener al menos una sede asignada.";
    }
    return null;
  }
  // USUARIO
  if (sedeIds.length !== 1) {
    return "El usuario debe tener exactamente una sede asignada.";
  }
  return null;
}

function parseUsuarioForm(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    rol: String(formData.get("rol") ?? "USUARIO"),
    activo: formData.get("activo") === "on",
    sedeIds: formData.getAll("sedeIds").map((s) => String(s)),
    password: String(formData.get("password") ?? ""),
  };
}

export async function crearUsuario(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const raw = parseUsuarioForm(formData);
  const parsed = usuarioBaseSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { nombre, email, rol, activo } = parsed.data;
  // Admin no requiere sedes; para los demás se aplican las reglas.
  const sedeIds = rol === "ADMINISTRADOR" ? [] : parsed.data.sedeIds;

  const reglaSedes = validarSedesPorRol(rol, sedeIds);
  if (reglaSedes) return { error: reglaSedes };

  if (raw.password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) return { error: "Ya existe un usuario con ese correo." };

  const passwordHash = await bcrypt.hash(raw.password, 10);

  await prisma.user.create({
    data: {
      nombre,
      email,
      passwordHash,
      rol,
      activo,
      sedes: {
        create: sedeIds.map((sedeId) => ({ sedeId })),
      },
    },
  });

  revalidatePath("/configuracion/usuarios");
  redirect("/configuracion/usuarios");
}

export async function actualizarUsuario(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actual = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Usuario no encontrado." };

  const raw = parseUsuarioForm(formData);
  const parsed = usuarioBaseSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { nombre, email, rol, activo } = parsed.data;
  const sedeIds = rol === "ADMINISTRADOR" ? [] : parsed.data.sedeIds;

  const reglaSedes = validarSedesPorRol(rol, sedeIds);
  if (reglaSedes) return { error: reglaSedes };

  const usuario = await prisma.user.findUnique({ where: { id } });
  if (!usuario) return { error: "Usuario no encontrado." };

  // Un admin no puede desactivarse a sí mismo.
  if (id === actual.id && !activo) {
    return { error: "No puedes desactivar tu propia cuenta." };
  }
  // Un admin no puede quitarse a sí mismo el rol de administrador.
  if (id === actual.id && rol !== "ADMINISTRADOR") {
    return { error: "No puedes cambiar tu propio rol de administrador." };
  }

  // Email único (excluyendo a sí mismo).
  const otro = await prisma.user.findUnique({ where: { email } });
  if (otro && otro.id !== id) {
    return { error: "Ya existe otro usuario con ese correo." };
  }

  const passwordPlano = raw.password.trim();
  if (passwordPlano && passwordPlano.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }
  const passwordHash = passwordPlano
    ? await bcrypt.hash(passwordPlano, 10)
    : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        nombre,
        email,
        rol,
        activo,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    // Sincroniza UserSede: borra y recrea según los checkboxes.
    await tx.userSede.deleteMany({ where: { userId: id } });
    if (sedeIds.length > 0) {
      await tx.userSede.createMany({
        data: sedeIds.map((sedeId) => ({ userId: id, sedeId })),
      });
    }
  });

  revalidatePath("/configuracion/usuarios");
  redirect("/configuracion/usuarios");
}

/* ════════════════════════════════════════════════════════
 * SEDES
 * ════════════════════════════════════════════════════════ */

const sedeSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  direccion: z.string().trim().optional().nullable(),
  telefono: z.string().trim().optional().nullable(),
  activo: z.boolean(),
});

function parseSedeForm(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    direccion: String(formData.get("direccion") ?? "") || null,
    telefono: String(formData.get("telefono") ?? "") || null,
    activo: formData.get("activo") === "on",
  };
}

export async function guardarSede(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = sedeSchema.safeParse(parseSedeForm(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { nombre, direccion, telefono, activo } = parsed.data;

  // Nombre único (excluyendo la propia sede al editar).
  const existente = await prisma.sede.findUnique({ where: { nombre } });
  if (existente && existente.id !== id) {
    return { error: "Ya existe una sede con ese nombre." };
  }

  if (id) {
    await prisma.sede.update({
      where: { id },
      data: { nombre, direccion, telefono, activo },
    });
  } else {
    await prisma.sede.create({
      data: { nombre, direccion, telefono, activo },
    });
  }

  revalidatePath("/configuracion/sedes");
  redirect("/configuracion/sedes");
}

/* ════════════════════════════════════════════════════════
 * TERAPEUTAS
 * ════════════════════════════════════════════════════════ */

const terapeutaSchema = z.object({
  sedeId: z.string().min(1, "La sede es obligatoria."),
  nombres: z.string().trim().min(1, "Los nombres son obligatorios."),
  apellidos: z.string().trim().min(1, "Los apellidos son obligatorios."),
  especialidad: z.string().trim().optional().nullable(),
  telefono: z.string().trim().optional().nullable(),
  activo: z.boolean(),
});

function parseTerapeutaForm(formData: FormData) {
  return {
    sedeId: String(formData.get("sedeId") ?? ""),
    nombres: String(formData.get("nombres") ?? ""),
    apellidos: String(formData.get("apellidos") ?? ""),
    especialidad: String(formData.get("especialidad") ?? "") || null,
    telefono: String(formData.get("telefono") ?? "") || null,
    activo: formData.get("activo") === "on",
  };
}

export async function guardarTerapeuta(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = terapeutaSchema.safeParse(parseTerapeutaForm(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { sedeId, nombres, apellidos, especialidad, telefono, activo } =
    parsed.data;

  const sede = await prisma.sede.findUnique({ where: { id: sedeId } });
  if (!sede) return { error: "La sede seleccionada no existe." };

  if (id) {
    await prisma.terapeuta.update({
      where: { id },
      data: { sedeId, nombres, apellidos, especialidad, telefono, activo },
    });
  } else {
    await prisma.terapeuta.create({
      data: { sedeId, nombres, apellidos, especialidad, telefono, activo },
    });
  }

  revalidatePath("/configuracion/terapeutas");
  redirect("/configuracion/terapeutas");
}
