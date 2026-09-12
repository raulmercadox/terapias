"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, assertSedeAccess, requireActiveSede } from "@/lib/session";
import { cupoTerapeuta, conflictoPaciente } from "@/lib/conflictos";
import { motivoFueraDeHorario } from "../sesiones/horario";
import { fecha as fmtFecha } from "@/lib/utils";

/* ── Validación ───────────────────────────────────────── */

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Medianoche local de una fecha (para comparar feriados por día). */
function medianoche(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Valida que la franja de una cita respete el horario laboral de la sede, que
 * la fecha no sea feriado y que el terapeuta no quede doble-reservado.
 * Devuelve un mensaje de error, o null si la franja es válida.
 */
async function validarFranjaCita(params: {
  sedeId: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  terapeutaId: string | null;
  pacienteId: string;
  maxPacientes: number;
  exceptCitaId?: string;
}): Promise<string | null> {
  const {
    sedeId,
    fecha,
    horaInicio,
    horaFin,
    terapeutaId,
    pacienteId,
    maxPacientes,
    exceptCitaId,
  } = params;

  const sede = await prisma.sede.findUnique({
    where: { id: sedeId },
    select: {
      horaApertura: true,
      horaCierre: true,
      diasLaborales: true,
      refrigerioInicio: true,
      refrigerioFin: true,
    },
  });
  if (sede) {
    const motivo = motivoFueraDeHorario(sede, fecha, horaInicio, horaFin);
    if (motivo) return motivo;
  }

  const feriado = await prisma.feriado.findUnique({
    where: { sedeId_fecha: { sedeId, fecha: medianoche(fecha) } },
    select: { descripcion: true },
  });
  if (feriado) {
    return `La fecha seleccionada es feriado${
      feriado.descripcion ? ` (${feriado.descripcion})` : ""
    }.`;
  }

  // El paciente no puede estar en dos sesiones a la vez.
  const pc = await conflictoPaciente(prisma, {
    pacienteId,
    fecha,
    horaInicio,
    horaFin,
    exceptCitaId,
  });
  if (pc) {
    return `El paciente ya tiene una sesión el ${fmtFecha(pc.fecha)} de ${pc.horaInicio} a ${pc.horaFin}. No puede estar en dos sesiones a la vez.`;
  }

  if (terapeutaId) {
    const cupo = await cupoTerapeuta(prisma, {
      terapeutaId,
      fecha,
      horaInicio,
      horaFin,
      maxPacientes,
      nuevoPacienteId: pacienteId,
      exceptCitaId,
    });
    if (cupo.excede && cupo.ejemplo) {
      const ej = cupo.ejemplo;
      if (maxPacientes <= 1) {
        return `El terapeuta ya tiene una cita el ${fmtFecha(ej.fecha)} de ${ej.horaInicio} a ${ej.horaFin} (${ej.pacienteNombre}).`;
      }
      return `El terapeuta ya alcanzó el cupo máximo (${maxPacientes}) el ${fmtFecha(ej.fecha)} de ${ej.horaInicio} a ${ej.horaFin}.`;
    }
  }

  return null;
}

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
  await assertSedeAccess(user, sedeId);

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

  const fechaCita = fechaDesdeInput(data.fecha);
  const err = await validarFranjaCita({
    sedeId,
    fecha: fechaCita,
    horaInicio: data.horaInicio,
    horaFin: data.horaFin,
    terapeutaId,
    pacienteId: data.pacienteId,
    // Las citas manuales no pertenecen a un programa: cupo individual (1).
    maxPacientes: 1,
  });
  if (err) return { error: err };

  await prisma.cita.create({
    data: {
      sedeId,
      pacienteId: data.pacienteId,
      terapeutaId,
      paqueteId: null,
      numeroSesion: null,
      fecha: fechaCita,
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
    select: {
      sedeId: true,
      paquete: { select: { programa: { select: { maxPacientes: true } } } },
    },
  });
  if (!cita) return { error: "Cita no encontrada." };
  await assertSedeAccess(user, cita.sedeId);

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

  const fechaCita = fechaDesdeInput(data.fecha);
  const err = await validarFranjaCita({
    sedeId: cita.sedeId,
    fecha: fechaCita,
    horaInicio: data.horaInicio,
    horaFin: data.horaFin,
    terapeutaId,
    pacienteId: data.pacienteId,
    maxPacientes: cita.paquete?.programa?.maxPacientes ?? 1,
    exceptCitaId: id,
  });
  if (err) return { error: err };

  await prisma.cita.update({
    where: { id },
    data: {
      pacienteId: data.pacienteId,
      terapeutaId,
      fecha: fechaCita,
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
  await assertSedeAccess(user, cita.sedeId);

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
  await assertSedeAccess(user, cita.sedeId);

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
  await assertSedeAccess(user, cita.sedeId);

  const parsed = seguimientoSchema.safeParse({
    terapiaRealizada: formData.get("terapiaRealizada") || undefined,
    observacion: formData.get("observacion") || undefined,
  });
  if (!parsed.success) return { error: "Datos inválidos." };

  const nuevaObservacion = parsed.data.observacion?.trim();

  // "Terapia realizada" sigue siendo un campo editable de la sesión.
  // La "Observación" en cambio se agrega como una entrada de historial
  // inmutable (no se sobrescribe la anterior).
  await prisma.$transaction(async (tx) => {
    await tx.cita.update({
      where: { id },
      data: { terapiaRealizada: parsed.data.terapiaRealizada ?? null },
    });

    if (nuevaObservacion) {
      await tx.observacionSesion.create({
        data: {
          citaId: id,
          texto: nuevaObservacion,
          autor: user.nombre ?? null,
        },
      });
    }
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
  await assertSedeAccess(user, cita.sedeId);

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
  await assertSedeAccess(user, cita.sedeId);

  await prisma.cita.update({
    where: { id },
    data: { recordatorioEnviado: true },
  });

  revalidatePath("/citas");
  revalidatePath(`/citas/${id}`);
}
