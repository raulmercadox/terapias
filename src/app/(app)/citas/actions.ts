"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, assertSedeAccess, requireActiveSede } from "@/lib/session";

/* ── Validación ───────────────────────────────────────── */

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const citaSchema = z
  .object({
    pacienteId: z.string().min(1, "Seleccione un paciente."),
    terapeutaId: z.string().optional(),
    fecha: z.string().min(1, "Indique la fecha."),
    horaInicio: z.string().regex(horaRegex, "Hora de inicio inválida."),
    horaFin: z.string().regex(horaRegex, "Hora de fin inválida."),
    tipo: z.enum(["CONSULTA", "EVALUACION", "SESION"]),
    observacion: z.string().optional(),
  })
  .refine((d) => d.horaFin > d.horaInicio, {
    message: "La hora de fin debe ser posterior a la de inicio.",
    path: ["horaFin"],
  });

export type FormState = { error?: string } | undefined;

/** Construye un Date a partir de "YYYY-MM-DD" a mediodía local (evita saltos por zona horaria). */
function fechaDesdeInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/* ── Crear ────────────────────────────────────────────── */

export async function crearCita(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  assertSedeAccess(user, sedeId);

  const parsed = citaSchema.safeParse({
    pacienteId: formData.get("pacienteId"),
    terapeutaId: formData.get("terapeutaId") || undefined,
    fecha: formData.get("fecha"),
    horaInicio: formData.get("horaInicio"),
    horaFin: formData.get("horaFin"),
    tipo: formData.get("tipo"),
    observacion: formData.get("observacion") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  // El paciente debe pertenecer a la sede activa.
  const paciente = await prisma.paciente.findFirst({
    where: { id: data.pacienteId, sedeId },
    select: { id: true },
  });
  if (!paciente) return { error: "El paciente no pertenece a esta sede." };

  // El terapeuta (si se eligió) debe pertenecer a la sede activa.
  let terapeutaId: string | null = null;
  if (data.terapeutaId) {
    const t = await prisma.terapeuta.findFirst({
      where: { id: data.terapeutaId, sedeId },
      select: { id: true },
    });
    if (!t) return { error: "El terapeuta no pertenece a esta sede." };
    terapeutaId = t.id;
  }

  await prisma.cita.create({
    data: {
      sedeId,
      pacienteId: data.pacienteId,
      terapeutaId,
      paqueteId: null,
      numeroSesion: null,
      fecha: fechaDesdeInput(data.fecha),
      horaInicio: data.horaInicio,
      horaFin: data.horaFin,
      tipo: data.tipo,
      observacion: data.observacion ?? null,
    },
  });

  revalidatePath("/citas");
  redirect("/citas");
}

/* ── Editar ───────────────────────────────────────────── */

export async function actualizarCita(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el identificador de la cita." };

  const cita = await prisma.cita.findUnique({
    where: { id },
    select: { sedeId: true },
  });
  if (!cita) return { error: "Cita no encontrada." };
  assertSedeAccess(user, cita.sedeId);

  const parsed = citaSchema.safeParse({
    pacienteId: formData.get("pacienteId"),
    terapeutaId: formData.get("terapeutaId") || undefined,
    fecha: formData.get("fecha"),
    horaInicio: formData.get("horaInicio"),
    horaFin: formData.get("horaFin"),
    tipo: formData.get("tipo"),
    observacion: formData.get("observacion") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const paciente = await prisma.paciente.findFirst({
    where: { id: data.pacienteId, sedeId: cita.sedeId },
    select: { id: true },
  });
  if (!paciente) return { error: "El paciente no pertenece a esta sede." };

  let terapeutaId: string | null = null;
  if (data.terapeutaId) {
    const t = await prisma.terapeuta.findFirst({
      where: { id: data.terapeutaId, sedeId: cita.sedeId },
      select: { id: true },
    });
    if (!t) return { error: "El terapeuta no pertenece a esta sede." };
    terapeutaId = t.id;
  }

  await prisma.cita.update({
    where: { id },
    data: {
      pacienteId: data.pacienteId,
      terapeutaId,
      fecha: fechaDesdeInput(data.fecha),
      horaInicio: data.horaInicio,
      horaFin: data.horaFin,
      tipo: data.tipo,
      observacion: data.observacion ?? null,
    },
  });

  revalidatePath("/citas");
  revalidatePath(`/citas/${id}`);
  redirect(`/citas/${id}`);
}

/* ── Marcar asistencia ────────────────────────────────── */

const asistenciaSchema = z.enum(["PENDIENTE", "ASISTIO", "FALTO", "TARDANZA"]);

export async function marcarAsistencia(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const asistencia = asistenciaSchema.parse(formData.get("asistencia"));

  const cita = await prisma.cita.findUnique({
    where: { id },
    select: { sedeId: true },
  });
  if (!cita) throw new Error("Cita no encontrada.");
  assertSedeAccess(user, cita.sedeId);

  await prisma.cita.update({ where: { id }, data: { asistencia } });

  revalidatePath("/citas");
  revalidatePath(`/citas/${id}`);
}

/* ── Cambiar estado ───────────────────────────────────── */

const estadoSchema = z.enum(["AGENDADA", "ATENDIDA", "CANCELADA"]);

export async function cambiarEstado(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const estado = estadoSchema.parse(formData.get("estado"));

  const cita = await prisma.cita.findUnique({
    where: { id },
    select: { sedeId: true },
  });
  if (!cita) throw new Error("Cita no encontrada.");
  assertSedeAccess(user, cita.sedeId);

  await prisma.cita.update({ where: { id }, data: { estado } });

  revalidatePath("/citas");
  revalidatePath(`/citas/${id}`);
}

/* ── Registrar terapia / observación ──────────────────── */

const seguimientoSchema = z.object({
  terapiaRealizada: z.string().optional(),
  observacion: z.string().optional(),
});

export async function registrarSeguimiento(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Falta el identificador de la cita." };

  const cita = await prisma.cita.findUnique({
    where: { id },
    select: { sedeId: true },
  });
  if (!cita) return { error: "Cita no encontrada." };
  assertSedeAccess(user, cita.sedeId);

  const parsed = seguimientoSchema.safeParse({
    terapiaRealizada: formData.get("terapiaRealizada") || undefined,
    observacion: formData.get("observacion") || undefined,
  });
  if (!parsed.success) return { error: "Datos inválidos." };

  await prisma.cita.update({
    where: { id },
    data: {
      terapiaRealizada: parsed.data.terapiaRealizada ?? null,
      observacion: parsed.data.observacion ?? null,
    },
  });

  revalidatePath(`/citas/${id}`);
  return undefined;
}

/* ── Eliminar ─────────────────────────────────────────── */

export async function eliminarCita(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const cita = await prisma.cita.findUnique({
    where: { id },
    select: { sedeId: true },
  });
  if (!cita) throw new Error("Cita no encontrada.");
  assertSedeAccess(user, cita.sedeId);

  await prisma.cita.delete({ where: { id } });

  revalidatePath("/citas");
  redirect("/citas");
}

/* ── Recordatorio WhatsApp ────────────────────────────── */

export async function marcarRecordatorioEnviado(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const cita = await prisma.cita.findUnique({
    where: { id },
    select: { sedeId: true },
  });
  if (!cita) throw new Error("Cita no encontrada.");
  assertSedeAccess(user, cita.sedeId);

  await prisma.cita.update({
    where: { id },
    data: { recordatorioEnviado: true },
  });

  revalidatePath("/citas");
  revalidatePath(`/citas/${id}`);
}
