"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireSuperadmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EMPRESA_PLATAFORMA } from "@/lib/auth";
import {
  CODIGO_EMPRESA_MSG,
  CODIGO_EMPRESA_RE,
  USUARIO_MSG,
  USUARIO_RE,
} from "@/lib/formatos";

export type FormState = { error?: string; ok?: string } | undefined;

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Datos inválidos.";
}

const centroSchema = z.object({
  codigo: z
    .string()
    .regex(CODIGO_EMPRESA_RE, CODIGO_EMPRESA_MSG)
    .refine((c) => c !== EMPRESA_PLATAFORMA, "Ese código está reservado."),
  nombre: z.string().trim().min(1, "El nombre del centro es obligatorio."),
  subtitulo: z.string().trim(),
});

const claveSchema = z.string().min(6, "La clave debe tener al menos 6 caracteres.");

function parseCentro(formData: FormData) {
  return {
    codigo: String(formData.get("codigo") ?? "").trim().toLowerCase(),
    nombre: String(formData.get("nombre") ?? ""),
    subtitulo: String(formData.get("subtitulo") ?? ""),
  };
}

/** Crea el centro con su primera sede y su administrador, todo junto. */
export async function crearCentro(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const centro = centroSchema.safeParse(parseCentro(formData));
  if (!centro.success) return { error: firstError(centro.error) };

  const extra = z
    .object({
      sedeNombre: z.string().trim().min(1, "El nombre de la sede es obligatorio."),
      adminNombre: z.string().trim().min(1, "El nombre del administrador es obligatorio."),
      adminUsuario: z.string().regex(USUARIO_RE, USUARIO_MSG),
      adminPassword: claveSchema,
    })
    .safeParse({
      sedeNombre: String(formData.get("sedeNombre") ?? ""),
      adminNombre: String(formData.get("adminNombre") ?? ""),
      adminUsuario: String(formData.get("adminUsuario") ?? "").trim().toLowerCase(),
      adminPassword: String(formData.get("adminPassword") ?? ""),
    });
  if (!extra.success) return { error: firstError(extra.error) };

  const { codigo, nombre, subtitulo } = centro.data;
  const { sedeNombre, adminNombre, adminUsuario, adminPassword } = extra.data;

  const existente = await prisma.centro.findUnique({ where: { codigo } });
  if (existente) return { error: "Ya existe un centro con ese código." };

  // Una sola sentencia con creates anidados: o se crea todo o nada.
  await prisma.centro.create({
    data: {
      codigo,
      nombre,
      subtitulo: subtitulo || null,
      sedes: { create: { nombre: sedeNombre } },
      usuarios: {
        create: {
          nombre: adminNombre,
          usuario: adminUsuario,
          passwordHash: await bcrypt.hash(adminPassword, 10),
          rol: "ADMINISTRADOR",
        },
      },
    },
  });

  revalidatePath("/plataforma/centros");
  redirect("/plataforma/centros");
}

export async function actualizarCentro(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  const parsed = centroSchema.safeParse(parseCentro(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { codigo, nombre, subtitulo } = parsed.data;
  const activo = formData.get("activo") === "on";

  const otro = await prisma.centro.findUnique({ where: { codigo } });
  if (otro && otro.id !== id) return { error: "Ya existe un centro con ese código." };

  const actual = await prisma.centro.findUnique({ where: { id }, select: { id: true } });
  if (!actual) return { error: "Centro no encontrado." };

  await prisma.centro.update({
    where: { id },
    data: { codigo, nombre, subtitulo: subtitulo || null, activo },
  });

  revalidatePath("/plataforma/centros");
  revalidatePath(`/plataforma/centros/${id}`);
  return { ok: "Cambios guardados." };
}

/** Restablece la clave de un usuario del centro (p. ej. el admin la olvidó). */
export async function restablecerClave(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireSuperadmin();

  const centroId = String(formData.get("centroId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const clave = claveSchema.safeParse(String(formData.get("password") ?? ""));
  if (!clave.success) return { error: firstError(clave.error) };

  const usuario = await prisma.user.findFirst({
    where: { id: userId, centroId },
    select: { id: true, usuario: true },
  });
  if (!usuario) return { error: "Usuario no encontrado." };

  await prisma.user.update({
    where: { id: usuario.id },
    data: { passwordHash: await bcrypt.hash(clave.data, 10) },
  });

  return { ok: `Clave de «${usuario.usuario}» actualizada.` };
}
