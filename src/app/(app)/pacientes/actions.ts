"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireActiveSede,
  assertSedeAccess,
  assertRolGestion,
} from "@/lib/session";

/* ── Helpers ──────────────────────────────────────────── */

/** Convierte "" en undefined para campos opcionales del formulario. */
function opt(value: FormDataEntryValue | null): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const SEXOS = ["M", "F"] as const;
const PROGRAMAS = ["ESCOLAR", "INTERDIARIO", "TERAPIAS"] as const;
const VINCULOS = ["MADRE", "PADRE", "APODERADO", "OTRO"] as const;
const ESTADOS = ["ACTIVO", "BAJA"] as const;

/* ── Esquemas ─────────────────────────────────────────── */

const pacienteSchema = z.object({
  nombres: z.string().trim().min(1, "Los nombres son obligatorios"),
  apellidoPaterno: z
    .string()
    .trim()
    .min(1, "El apellido paterno es obligatorio"),
  apellidoMaterno: z.string().trim().optional(),
  dni: z.string().trim().optional(),
  fechaNacimiento: z.string().trim().optional(),
  sexo: z.enum(SEXOS).optional(),
  telefono: z.string().trim().optional(),
  correo: z.union([z.email("Correo inválido"), z.literal("")]).optional(),
  direccion: z.string().trim().optional(),
  distrito: z.string().trim().optional(),
  fotoUrl: z
    .union([z.url("La foto debe ser una URL válida"), z.literal("")])
    .optional(),
  programa: z.enum(PROGRAMAS),
  diagnostico: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
});

const apoderadoSchema = z.object({
  nombres: z.string().trim().min(1, "Los nombres son obligatorios"),
  apellidos: z.string().trim().optional(),
  dni: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  correo: z.union([z.email("Correo inválido"), z.literal("")]).optional(),
  vinculo: z.enum(VINCULOS),
  principal: z.boolean().optional(),
});

/** Mapea ZodError a fieldErrors planos. */
function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Lee del FormData los datos de paciente y los normaliza para Prisma. */
function parsePacienteForm(formData: FormData) {
  return pacienteSchema.safeParse({
    nombres: formData.get("nombres") ?? "",
    apellidoPaterno: formData.get("apellidoPaterno") ?? "",
    apellidoMaterno: opt(formData.get("apellidoMaterno")),
    dni: opt(formData.get("dni")),
    fechaNacimiento: opt(formData.get("fechaNacimiento")),
    sexo: opt(formData.get("sexo")) as "M" | "F" | undefined,
    telefono: opt(formData.get("telefono")),
    correo: formData.get("correo") ?? "",
    direccion: opt(formData.get("direccion")),
    distrito: opt(formData.get("distrito")),
    fotoUrl: formData.get("fotoUrl") ?? "",
    programa: (opt(formData.get("programa")) ?? "TERAPIAS") as
      | "ESCOLAR"
      | "INTERDIARIO"
      | "TERAPIAS",
    diagnostico: opt(formData.get("diagnostico")),
    observaciones: opt(formData.get("observaciones")),
  });
}

/** Construye el objeto de datos de Prisma a partir de un paciente validado. */
function pacienteData(d: z.infer<typeof pacienteSchema>) {
  return {
    nombres: d.nombres,
    apellidoPaterno: d.apellidoPaterno,
    apellidoMaterno: d.apellidoMaterno ?? null,
    dni: d.dni ?? null,
    fechaNacimiento: d.fechaNacimiento ? new Date(d.fechaNacimiento) : null,
    sexo: d.sexo ?? null,
    telefono: d.telefono ?? null,
    correo: d.correo ? d.correo : null,
    direccion: d.direccion ?? null,
    distrito: d.distrito ?? null,
    fotoUrl: d.fotoUrl ? d.fotoUrl : null,
    programa: d.programa,
    diagnostico: d.diagnostico ?? null,
    observaciones: d.observaciones ?? null,
  };
}

/* ── Pacientes ────────────────────────────────────────── */

export async function crearPaciente(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertRolGestion(user);
  const sedeId = await requireActiveSede(user);
  assertSedeAccess(user, sedeId);

  const parsed = parsePacienteForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisa los campos del formulario.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  // Apoderado opcional capturado en el alta (madre/padre/apoderado).
  const apoNombres = opt(formData.get("apo_nombres"));
  let apoderado: z.infer<typeof apoderadoSchema> | null = null;
  if (apoNombres) {
    const apoParsed = apoderadoSchema.safeParse({
      nombres: apoNombres,
      apellidos: opt(formData.get("apo_apellidos")),
      dni: opt(formData.get("apo_dni")),
      telefono: opt(formData.get("apo_telefono")),
      correo: formData.get("apo_correo") ?? "",
      vinculo: (opt(formData.get("apo_vinculo")) ?? "APODERADO") as
        | "MADRE"
        | "PADRE"
        | "APODERADO"
        | "OTRO",
      principal: true,
    });
    if (!apoParsed.success) {
      const fe = toFieldErrors(apoParsed.error);
      return {
        error: "Revisa los datos del apoderado.",
        fieldErrors: Object.fromEntries(
          Object.entries(fe).map(([k, v]) => [`apo_${k}`, v]),
        ),
      };
    }
    apoderado = apoParsed.data;
  }

  const paciente = await prisma.paciente.create({
    data: {
      sedeId,
      ...pacienteData(parsed.data),
      ...(apoderado
        ? {
            apoderados: {
              create: {
                nombres: apoderado.nombres,
                apellidos: apoderado.apellidos ?? null,
                dni: apoderado.dni ?? null,
                telefono: apoderado.telefono ?? null,
                correo: apoderado.correo ? apoderado.correo : null,
                vinculo: apoderado.vinculo,
                principal: true,
              },
            },
          }
        : {}),
    },
  });

  revalidatePath("/pacientes");
  redirect(`/pacientes/${paciente.id}`);
}

export async function actualizarPaciente(
  pacienteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertRolGestion(user);

  const existente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { sedeId: true },
  });
  if (!existente) return { error: "El paciente no existe." };
  assertSedeAccess(user, existente.sedeId);

  const parsed = parsePacienteForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisa los campos del formulario.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  await prisma.paciente.update({
    where: { id: pacienteId },
    data: pacienteData(parsed.data),
  });

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${pacienteId}`);
  redirect(`/pacientes/${pacienteId}`);
}

export async function cambiarEstado(pacienteId: string, estado: string) {
  const user = await requireUser();
  assertRolGestion(user);

  const existente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { sedeId: true },
  });
  if (!existente) throw new Error("El paciente no existe.");
  assertSedeAccess(user, existente.sedeId);

  const nuevoEstado = z.enum(ESTADOS).parse(estado);

  await prisma.paciente.update({
    where: { id: pacienteId },
    data: { estado: nuevoEstado },
  });

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${pacienteId}`);
}

/* ── Apoderados ───────────────────────────────────────── */

/** Comprueba acceso al paciente dueño del apoderado y devuelve su sedeId. */
async function assertPacienteAccess(user: Awaited<ReturnType<typeof requireUser>>, pacienteId: string) {
  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { sedeId: true },
  });
  if (!paciente) throw new Error("El paciente no existe.");
  assertSedeAccess(user, paciente.sedeId);
}

function parseApoderadoForm(formData: FormData) {
  return apoderadoSchema.safeParse({
    nombres: formData.get("nombres") ?? "",
    apellidos: opt(formData.get("apellidos")),
    dni: opt(formData.get("dni")),
    telefono: opt(formData.get("telefono")),
    correo: formData.get("correo") ?? "",
    vinculo: (opt(formData.get("vinculo")) ?? "APODERADO") as
      | "MADRE"
      | "PADRE"
      | "APODERADO"
      | "OTRO",
    principal: formData.get("principal") === "on",
  });
}

export async function agregarApoderado(
  pacienteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertRolGestion(user);
  await assertPacienteAccess(user, pacienteId);

  const parsed = parseApoderadoForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisa los datos del apoderado.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const d = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (d.principal) {
      await tx.apoderado.updateMany({
        where: { pacienteId },
        data: { principal: false },
      });
    }
    await tx.apoderado.create({
      data: {
        pacienteId,
        nombres: d.nombres,
        apellidos: d.apellidos ?? null,
        dni: d.dni ?? null,
        telefono: d.telefono ?? null,
        correo: d.correo ? d.correo : null,
        vinculo: d.vinculo,
        principal: d.principal ?? false,
      },
    });
  });

  revalidatePath(`/pacientes/${pacienteId}`);
  return {};
}

export async function actualizarApoderado(
  apoderadoId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertRolGestion(user);

  const apo = await prisma.apoderado.findUnique({
    where: { id: apoderadoId },
    select: { pacienteId: true },
  });
  if (!apo) return { error: "El apoderado no existe." };
  await assertPacienteAccess(user, apo.pacienteId);

  const parsed = parseApoderadoForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisa los datos del apoderado.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const d = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (d.principal) {
      await tx.apoderado.updateMany({
        where: { pacienteId: apo.pacienteId, NOT: { id: apoderadoId } },
        data: { principal: false },
      });
    }
    await tx.apoderado.update({
      where: { id: apoderadoId },
      data: {
        nombres: d.nombres,
        apellidos: d.apellidos ?? null,
        dni: d.dni ?? null,
        telefono: d.telefono ?? null,
        correo: d.correo ? d.correo : null,
        vinculo: d.vinculo,
        principal: d.principal ?? false,
      },
    });
  });

  revalidatePath(`/pacientes/${apo.pacienteId}`);
  return {};
}

export async function eliminarApoderado(apoderadoId: string) {
  const user = await requireUser();
  assertRolGestion(user);

  const apo = await prisma.apoderado.findUnique({
    where: { id: apoderadoId },
    select: { pacienteId: true },
  });
  if (!apo) throw new Error("El apoderado no existe.");
  await assertPacienteAccess(user, apo.pacienteId);

  await prisma.apoderado.delete({ where: { id: apoderadoId } });

  revalidatePath(`/pacientes/${apo.pacienteId}`);
}
