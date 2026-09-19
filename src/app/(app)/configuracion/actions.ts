"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { USUARIO_MSG, USUARIO_RE } from "@/lib/formatos";
import { obtenerPlantilla } from "@/lib/plantillas";
import { aplicarEdicion, parseEdicion } from "@/lib/fichas/editor";
import { idsDuplicados } from "@/lib/fichas/plantilla";
import { esBaseValida, plantillaBase } from "@/lib/fichas/base";
import { TIPOS_FICHA, type TipoFicha } from "@/lib/fichas/tipos";
import { LOGO_MAX_BYTES, LOGO_TIPOS } from "@/lib/logo";

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

/** La sede, solo si pertenece al centro (si no, null: como si no existiera). */
function sedeDelCentro(centroId: string, sedeId: string) {
  return prisma.sede.findFirst({ where: { id: sedeId, centroId } });
}

/* ════════════════════════════════════════════════════════
 * USUARIOS
 * ════════════════════════════════════════════════════════ */

const rolEnum = z.enum(["ADMINISTRADOR", "COORDINADOR", "USUARIO"]);

const usuarioBaseSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  usuario: z.string().regex(USUARIO_RE, USUARIO_MSG),
  email: z.union([z.literal(""), z.email("Correo electrónico inválido.")]),
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

/** ¿Todas las sedes asignadas pertenecen al centro? */
async function sedesSonDelCentro(centroId: string, sedeIds: string[]) {
  const unicas = new Set(sedeIds);
  if (unicas.size === 0) return true;
  const n = await prisma.sede.count({
    where: { id: { in: [...unicas] }, centroId },
  });
  return n === unicas.size;
}

function parseUsuarioForm(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    usuario: String(formData.get("usuario") ?? "").trim().toLowerCase(),
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
  const { centroId } = await requireAdmin();

  const raw = parseUsuarioForm(formData);
  const parsed = usuarioBaseSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { nombre, usuario, rol, activo } = parsed.data;
  const email = parsed.data.email || null;
  // Admin no requiere sedes; para los demás se aplican las reglas.
  const sedeIds = rol === "ADMINISTRADOR" ? [] : parsed.data.sedeIds;

  const reglaSedes = validarSedesPorRol(rol, sedeIds);
  if (reglaSedes) return { error: reglaSedes };
  if (!(await sedesSonDelCentro(centroId, sedeIds))) {
    return { error: "Alguna de las sedes seleccionadas no existe." };
  }

  if (raw.password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const existente = await prisma.user.findFirst({ where: { centroId, usuario } });
  if (existente) return { error: "Ya existe un usuario con ese nombre de usuario." };

  const passwordHash = await bcrypt.hash(raw.password, 10);

  await prisma.user.create({
    data: {
      centroId,
      nombre,
      usuario,
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

  const { nombre, usuario, rol, activo } = parsed.data;
  const email = parsed.data.email || null;
  const sedeIds = rol === "ADMINISTRADOR" ? [] : parsed.data.sedeIds;
  const { centroId } = actual;

  const reglaSedes = validarSedesPorRol(rol, sedeIds);
  if (reglaSedes) return { error: reglaSedes };
  if (!(await sedesSonDelCentro(centroId, sedeIds))) {
    return { error: "Alguna de las sedes seleccionadas no existe." };
  }

  const registro = await prisma.user.findFirst({ where: { id, centroId } });
  if (!registro) return { error: "Usuario no encontrado." };

  // Un admin no puede desactivarse a sí mismo.
  if (id === actual.id && !activo) {
    return { error: "No puedes desactivar tu propia cuenta." };
  }
  // Un admin no puede quitarse a sí mismo el rol de administrador.
  if (id === actual.id && rol !== "ADMINISTRADOR") {
    return { error: "No puedes cambiar tu propio rol de administrador." };
  }

  // Usuario único dentro del centro (excluyendo a sí mismo).
  const otro = await prisma.user.findFirst({ where: { centroId, usuario } });
  if (otro && otro.id !== id) {
    return { error: "Ya existe otro usuario con ese nombre de usuario." };
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
        usuario,
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
  const { centroId } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = sedeSchema.safeParse(parseSedeForm(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { nombre, direccion, telefono, activo } = parsed.data;

  // Nombre único en el centro (excluyendo la propia sede al editar).
  const existente = await prisma.sede.findFirst({ where: { centroId, nombre } });
  if (existente && existente.id !== id) {
    return { error: "Ya existe una sede con ese nombre." };
  }

  if (id) {
    if (!(await sedeDelCentro(centroId, id))) {
      return { error: "Sede no encontrada." };
    }
    await prisma.sede.update({
      where: { id },
      data: { nombre, direccion, telefono, activo },
    });
  } else {
    await prisma.sede.create({
      data: { centroId, nombre, direccion, telefono, activo },
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
  const { centroId } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = terapeutaSchema.safeParse(parseTerapeutaForm(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { sedeId, nombres, apellidos, especialidad, telefono, activo } =
    parsed.data;

  const sede = await sedeDelCentro(centroId, sedeId);
  if (!sede) return { error: "La sede seleccionada no existe." };

  if (id) {
    const actual = await prisma.terapeuta.findFirst({
      where: { id, sede: { centroId } },
      select: { id: true },
    });
    if (!actual) return { error: "Terapeuta no encontrado." };

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

/* ════════════════════════════════════════════════════════
 * PROGRAMAS (configurables por sede, con duración de sesión)
 * ════════════════════════════════════════════════════════ */

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const programaSchema = z.object({
  sedeId: z.string().min(1, "La sede es obligatoria."),
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  duracionMin: z.coerce
    .number()
    .int("La duración debe ser un número entero.")
    .min(5, "Mínimo 5 minutos.")
    .max(480, "Máximo 480 minutos."),
  maxPacientes: z.coerce
    .number()
    .int("El cupo debe ser un número entero.")
    .min(1, "Mínimo 1 paciente.")
    .max(50, "Máximo 50 pacientes."),
  activo: z.boolean(),
});

export async function guardarPrograma(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { centroId } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const parsed = programaSchema.safeParse({
    sedeId: String(formData.get("sedeId") ?? ""),
    nombre: String(formData.get("nombre") ?? ""),
    duracionMin: String(formData.get("duracionMin") ?? ""),
    maxPacientes: String(formData.get("maxPacientes") ?? ""),
    activo: formData.get("activo") === "on",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { sedeId, nombre, duracionMin, maxPacientes, activo } = parsed.data;

  const sede = await sedeDelCentro(centroId, sedeId);
  if (!sede) return { error: "La sede seleccionada no existe." };

  if (id) {
    const actual = await prisma.programaTerapia.findFirst({
      where: { id, sede: { centroId } },
      select: { id: true },
    });
    if (!actual) return { error: "Programa no encontrado." };
  }

  // Nombre único por sede (excluyendo el propio al editar).
  const existente = await prisma.programaTerapia.findFirst({
    where: { sedeId, nombre },
    select: { id: true },
  });
  if (existente && existente.id !== id) {
    return { error: "Ya existe un programa con ese nombre en la sede." };
  }

  if (id) {
    await prisma.programaTerapia.update({
      where: { id },
      data: { sedeId, nombre, duracionMin, maxPacientes, activo },
    });
  } else {
    await prisma.programaTerapia.create({
      data: { sedeId, nombre, duracionMin, maxPacientes, activo },
    });
  }

  revalidatePath("/configuracion/programas");
  redirect("/configuracion/programas");
}

/* ════════════════════════════════════════════════════════
 * HORARIO LABORAL (por sede)
 * ════════════════════════════════════════════════════════ */

const horarioSchema = z
  .object({
    sedeId: z.string().min(1, "La sede es obligatoria."),
    horaApertura: z.string().regex(HORA_RE, "Hora de apertura inválida."),
    horaCierre: z.string().regex(HORA_RE, "Hora de cierre inválida."),
    diasLaborales: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, "Seleccione al menos un día laboral."),
    // Lista escrita como "15, 30, 45, 60": opciones del selector de intervalo.
    intervalosCalendario: z
      .string()
      .transform((s) =>
        s
          .split(/[,;\s]+/)
          .filter(Boolean)
          .map((v) => Number(v)),
      )
      .refine(
        (arr) => arr.length > 0,
        "Ingrese al menos un intervalo (ej. 15, 30, 45, 60).",
      )
      .refine((arr) => arr.length <= 10, "Máximo 10 intervalos.")
      .refine(
        (arr) =>
          arr.every(
            (v) => Number.isInteger(v) && v >= 5 && v <= 120 && v % 5 === 0,
          ),
        "Cada intervalo debe ser un múltiplo de 5 entre 5 y 120 minutos.",
      ),
    intervaloCalendario: z.coerce.number().int("Intervalo inicial inválido."),
    // Refrigerio opcional: los <input type="time"> vacíos llegan como "".
    refrigerioInicio: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s === "" || HORA_RE.test(s), "Hora de refrigerio inválida."),
    refrigerioFin: z
      .string()
      .transform((s) => s.trim())
      .refine((s) => s === "" || HORA_RE.test(s), "Hora de refrigerio inválida."),
  })
  .refine((d) => d.horaCierre > d.horaApertura, {
    message: "El cierre debe ser posterior a la apertura.",
    path: ["horaCierre"],
  })
  .refine((d) => (d.refrigerioInicio === "") === (d.refrigerioFin === ""), {
    message: "Indique el inicio y el fin del refrigerio, o deje ambos vacíos.",
    path: ["refrigerioFin"],
  })
  .refine((d) => d.refrigerioInicio === "" || d.refrigerioFin > d.refrigerioInicio, {
    message: "El fin del refrigerio debe ser posterior a su inicio.",
    path: ["refrigerioFin"],
  })
  .refine(
    (d) =>
      d.refrigerioInicio === "" ||
      (d.refrigerioInicio < d.horaCierre && d.refrigerioFin > d.horaApertura),
    {
      message: "El refrigerio debe caer dentro del horario de atención.",
      path: ["refrigerioInicio"],
    },
  )
  .refine((d) => d.intervalosCalendario.includes(d.intervaloCalendario), {
    message: "El intervalo inicial debe estar en la lista de intervalos.",
    path: ["intervaloCalendario"],
  });

export async function guardarHorarioLaboral(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { centroId } = await requireAdmin();

  const parsed = horarioSchema.safeParse({
    sedeId: String(formData.get("sedeId") ?? ""),
    horaApertura: String(formData.get("horaApertura") ?? ""),
    horaCierre: String(formData.get("horaCierre") ?? ""),
    diasLaborales: formData.getAll("diasLaborales").map((d) => Number(d)),
    intervalosCalendario: String(formData.get("intervalosCalendario") ?? ""),
    intervaloCalendario: String(formData.get("intervaloCalendario") ?? "30"),
    refrigerioInicio: String(formData.get("refrigerioInicio") ?? ""),
    refrigerioFin: String(formData.get("refrigerioFin") ?? ""),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const {
    sedeId,
    horaApertura,
    horaCierre,
    diasLaborales,
    intervalosCalendario,
    intervaloCalendario,
    refrigerioInicio,
    refrigerioFin,
  } = parsed.data;

  const sede = await sedeDelCentro(centroId, sedeId);
  if (!sede) return { error: "La sede seleccionada no existe." };

  // Orden ascendente y sin duplicados.
  const dias = Array.from(new Set(diasLaborales)).sort((a, b) => a - b);
  const intervalos = Array.from(new Set(intervalosCalendario)).sort(
    (a, b) => a - b,
  );

  await prisma.sede.update({
    where: { id: sedeId },
    data: {
      horaApertura,
      horaCierre,
      // Vacío = sin refrigerio; los dos campos van juntos.
      refrigerioInicio: refrigerioInicio || null,
      refrigerioFin: refrigerioFin || null,
      diasLaborales: dias,
      intervalosCalendario: intervalos,
      intervaloCalendario,
    },
  });

  revalidatePath("/configuracion/horario");
  redirect(`/configuracion/horario?sede=${sedeId}&ok=1`);
}

/* ════════════════════════════════════════════════════════
 * FICHAS CLÍNICAS (plantilla por centro y tipo de ficha)
 * ════════════════════════════════════════════════════════ */

/** El tipo de ficha llega del formulario: se valida contra el enum. */
function tipoDeFicha(formData: FormData): TipoFicha | null {
  const t = String(formData.get("tipo") ?? "");
  return (TIPOS_FICHA as readonly string[]).includes(t) ? (t as TipoFicha) : null;
}

export async function guardarPlantilla(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { centroId } = await requireAdmin();

  const tipo = tipoDeFicha(formData);
  if (!tipo) return { error: "Tipo de ficha inválido." };

  const actual = await obtenerPlantilla(centroId, tipo);
  const editada = aplicarEdicion(actual.plantilla, parseEdicion(formData));

  const repetidos = idsDuplicados(editada);
  if (repetidos.length > 0) {
    return { error: `Hay identificadores repetidos: ${repetidos.join(", ")}.` };
  }
  if (editada.secciones.length === 0) {
    return { error: "La plantilla quedaría sin secciones." };
  }

  await prisma.plantillaFicha.upsert({
    where: { centroId_tipo: { centroId, tipo } },
    create: {
      centroId,
      tipo,
      base: "personalizada",
      version: 1,
      secciones: editada as unknown as Prisma.InputJsonValue,
    },
    // La versión sube en cada guardado: es lo que permite avisar en una ficha
    // congelada (evaluación) que la plantilla del centro avanzó.
    update: {
      base: "personalizada",
      version: { increment: 1 },
      secciones: editada as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/configuracion/fichas");
  redirect(`/configuracion/fichas/${tipo}?ok=1`);
}

/** Vuelve a la plantilla prearmada del rubro elegido, descartando lo editado. */
export async function restaurarPlantillaBase(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { centroId } = await requireAdmin();

  const tipo = tipoDeFicha(formData);
  if (!tipo) return { error: "Tipo de ficha inválido." };

  const base = String(formData.get("base") ?? "");
  if (!esBaseValida(base)) return { error: "Plantilla base inválida." };

  const plantilla = plantillaBase(base, tipo);

  await prisma.plantillaFicha.upsert({
    where: { centroId_tipo: { centroId, tipo } },
    create: {
      centroId,
      tipo,
      base,
      version: 1,
      secciones: plantilla as unknown as Prisma.InputJsonValue,
    },
    update: {
      base,
      version: { increment: 1 },
      secciones: plantilla as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/configuracion/fichas");
  redirect(`/configuracion/fichas/${tipo}?ok=1`);
}

/* ════════════════════════════════════════════════════════
 * COBRANZA (una fila por centro, vale para todas sus sedes)
 * ════════════════════════════════════════════════════════ */

const cobranzaSchema = z
  .object({
    graciaTipo: z.enum(["PORCENTAJE", "DIAS"], "Elija el tipo de periodo de gracia."),
    graciaValor: z.coerce.number().int("El periodo de gracia debe ser un número entero."),
    diasAvisoCobro: z.coerce
      .number()
      .int("Los días de aviso deben ser un número entero.")
      .min(0, "Los días de aviso van de 0 a 60.")
      .max(60, "Los días de aviso van de 0 a 60."),
  })
  .refine(
    (d) => d.graciaTipo !== "PORCENTAJE" || (d.graciaValor >= 1 && d.graciaValor <= 100),
    { message: "El porcentaje debe estar entre 1 y 100.", path: ["graciaValor"] },
  )
  .refine((d) => d.graciaTipo !== "DIAS" || (d.graciaValor >= 0 && d.graciaValor <= 180), {
    message: "Los días fijos deben estar entre 0 y 180.",
    path: ["graciaValor"],
  });

export async function guardarConfiguracionCobranza(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { centroId } = await requireAdmin();

  const parsed = cobranzaSchema.safeParse({
    graciaTipo: formData.get("graciaTipo"),
    graciaValor: formData.get("graciaValor"),
    diasAvisoCobro: formData.get("diasAvisoCobro"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  await prisma.configuracion.upsert({
    where: { centroId },
    create: { centroId, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/configuracion/cobranza");
  revalidatePath("/pagos/cobranza");
  redirect("/configuracion/cobranza?ok=1");
}

/* ════════════════════════════════════════════════════════
 * LOGO DEL CENTRO (menú y documentos impresos)
 * ════════════════════════════════════════════════════════ */

export async function subirLogoCentro(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { centroId } = await requireAdmin();

  const archivo = formData.get("logo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Elige una imagen." };
  }
  if (!(LOGO_TIPOS as readonly string[]).includes(archivo.type)) {
    return { error: "Formato no admitido. Usa PNG, JPG o WebP." };
  }
  if (archivo.size > LOGO_MAX_BYTES) {
    return { error: "El logo no puede superar 450 KB." };
  }

  const base64 = Buffer.from(await archivo.arrayBuffer()).toString("base64");
  await prisma.centro.update({
    where: { id: centroId },
    data: { logoBase64: `data:${archivo.type};base64,${base64}`, logoActualizadoEn: new Date() },
  });

  // El logo aparece en el menú (layout) y en los documentos impresos.
  revalidatePath("/", "layout");
  redirect("/configuracion/logo?ok=1");
}

export async function quitarLogoCentro(): Promise<void> {
  const { centroId } = await requireAdmin();
  await prisma.centro.update({
    where: { id: centroId },
    data: { logoBase64: null, logoActualizadoEn: null },
  });
  revalidatePath("/", "layout");
  redirect("/configuracion/logo");
}

/* ════════════════════════════════════════════════════════
 * FERIADOS (por sede)
 * ════════════════════════════════════════════════════════ */

const feriadoSchema = z.object({
  sedeId: z.string().min(1, "La sede es obligatoria."),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Indique una fecha válida."),
  descripcion: z.string().trim().optional().nullable(),
});

/** "YYYY-MM-DD" → Date a medianoche local. */
function fechaMedianoche(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export async function crearFeriado(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { centroId } = await requireAdmin();

  const parsed = feriadoSchema.safeParse({
    sedeId: String(formData.get("sedeId") ?? ""),
    fecha: String(formData.get("fecha") ?? ""),
    descripcion: String(formData.get("descripcion") ?? "") || null,
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { sedeId, fecha, descripcion } = parsed.data;

  const sede = await sedeDelCentro(centroId, sedeId);
  if (!sede) return { error: "La sede seleccionada no existe." };

  const existente = await prisma.feriado.findUnique({
    where: { sedeId_fecha: { sedeId, fecha: fechaMedianoche(fecha) } },
    select: { id: true },
  });
  if (existente) return { error: "Ya hay un feriado registrado en esa fecha." };

  await prisma.feriado.create({
    data: { sedeId, fecha: fechaMedianoche(fecha), descripcion },
  });

  revalidatePath("/configuracion/feriados");
  redirect(`/configuracion/feriados?sede=${sedeId}`);
}

export async function eliminarFeriado(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { centroId } = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Feriado no encontrado." };

  const feriado = await prisma.feriado.findFirst({
    where: { id, sede: { centroId } },
    select: { sedeId: true },
  });
  if (!feriado) return { error: "Feriado no encontrado." };

  await prisma.feriado.delete({ where: { id } });

  revalidatePath("/configuracion/feriados");
  redirect(`/configuracion/feriados?sede=${feriado.sedeId}`);
}
