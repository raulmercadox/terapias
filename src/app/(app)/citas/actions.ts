"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  assertSedeAccess,
  requireActiveSede,
  esTerapeuta,
  assertCitaPropia,
  assertPermiso,
  terapeutaDe,
} from "@/lib/session";
import { cupoTerapeuta, conflictoPaciente } from "@/lib/conflictos";
import { motivoFueraDeHorario } from "../sesiones/horario";
import { fecha as fmtFecha, hoyLima, sumarMinutos } from "@/lib/utils";
import { TIPO_LABEL } from "./helpers";
import { crearPagoConRecibo } from "../pagos/crear-pago";

/* ── Validación ───────────────────────────────────────── */

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Medianoche local de una fecha (para comparar feriados por día). */
function medianoche(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Valida que la franja de una cita respete el horario laboral de la sede (con
 * el refrigerio del terapeuta si tiene uno propio), que la fecha no sea
 * feriado ni vacaciones del terapeuta y que este no quede doble-reservado.
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
  // Refrigerio propio del terapeuta (reemplaza al de la sede) y vacaciones.
  const terapeuta = terapeutaId
    ? await prisma.terapeuta.findUnique({
        where: { id: terapeutaId },
        select: { refrigerioInicio: true, refrigerioFin: true },
      })
    : null;
  if (sede) {
    const motivo = motivoFueraDeHorario(
      sede,
      fecha,
      horaInicio,
      horaFin,
      terapeuta,
    );
    if (motivo) return motivo;
  }
  if (terapeutaId) {
    const dia = medianoche(fecha);
    const vacacion = await prisma.vacacionTerapeuta.findFirst({
      where: { terapeutaId, fechaInicio: { lte: dia }, fechaFin: { gte: dia } },
      select: { descripcion: true },
    });
    if (vacacion) {
      return `El terapeuta está de vacaciones en esa fecha${
        vacacion.descripcion ? ` (${vacacion.descripcion})` : ""
      }.`;
    }
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
  // El terapeuta no agenda citas libremente: usa el registro rápido.
  if (esTerapeuta(user)) return { error: "No tiene permisos para esta operación." };
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
      pacienteId: true,
      terapeutaId: true,
      tipo: true,
      paquete: { select: { programa: { select: { maxPacientes: true } } } },
    },
  });
  if (!cita) return { error: "Cita no encontrada." };
  await assertSedeAccess(user, cita.sedeId);
  const terapeuta = esTerapeuta(user);
  if (terapeuta) {
    assertPermiso(user, "MOVER_CITAS");
    assertCitaPropia(user, cita);
  }

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
  // El terapeuta solo mueve la cita (fecha y hora): paciente, terapeuta y
  // tipo se quedan como estaban.
  const data = terapeuta
    ? {
        ...parsed.data,
        pacienteId: cita.pacienteId,
        terapeutaId: cita.terapeutaId ?? undefined,
        tipo: cita.tipo,
      }
    : parsed.data;

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
    select: { sedeId: true, terapeutaId: true },
  });
  if (!cita) throw new Error("Cita no encontrada.");
  await assertSedeAccess(user, cita.sedeId);
  assertCitaPropia(user, cita);

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
    select: { sedeId: true, terapeutaId: true, estado: true },
  });
  if (!cita) throw new Error("Cita no encontrada.");
  await assertSedeAccess(user, cita.sedeId);
  assertCitaPropia(user, cita);
  // Cancelar (o reactivar una cancelada) es un permiso aparte del terapeuta.
  if (estado === "CANCELADA" || cita.estado === "CANCELADA") {
    assertPermiso(user, "CANCELAR_CITAS");
  }

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
    select: { sedeId: true, terapeutaId: true },
  });
  if (!cita) return { error: "Cita no encontrada." };
  await assertSedeAccess(user, cita.sedeId);
  assertCitaPropia(user, cita);

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
    select: { sedeId: true, terapeutaId: true, paqueteId: true },
  });
  if (!cita) throw new Error("Cita no encontrada.");
  await assertSedeAccess(user, cita.sedeId);
  assertCitaPropia(user, cita);
  if (esTerapeuta(user)) {
    assertPermiso(user, "ELIMINAR_CITAS");
    // Las sesiones de un paquete las gestiona recepción (afecta el paquete).
    if (cita.paqueteId) throw new Error("No puede eliminar sesiones de un paquete.");
  }

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
    select: { sedeId: true, terapeutaId: true },
  });
  if (!cita) throw new Error("Cita no encontrada.");
  await assertSedeAccess(user, cita.sedeId);
  assertCitaPropia(user, cita);

  await prisma.cita.update({
    where: { id },
    data: { recordatorioEnviado: true },
  });

  revalidatePath("/citas");
  revalidatePath(`/citas/${id}`);
}

/* ── Registro rápido (terapeuta, al vuelo) ────────────── */

const DURACIONES_RAPIDA = [30, 45, 60, 90] as const;

const citaRapidaSchema = z.object({
  pacienteNuevo: z.boolean(),
  pacienteId: z.string(),
  nombres: z.string().trim(),
  apellidoPaterno: z.string().trim(),
  telefono: z.string().trim(),
  tipo: z.enum(["CONSULTA", "EVALUACION", "SESION"]),
  horaInicio: z.string().regex(horaRegex, "Hora de inicio inválida."),
  duracion: z.coerce
    .number()
    .refine(
      (n) => (DURACIONES_RAPIDA as readonly number[]).includes(n),
      "Duración inválida.",
    ),
});

/**
 * Cita para hoy, del propio terapeuta, para pacientes que llegan sin cita.
 * Con PACIENTE_AL_VUELO puede además dar de alta a un paciente nuevo con
 * datos mínimos (el resto lo completa recepción después).
 */
export async function crearCitaRapida(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertPermiso(user, "CITA_AL_VUELO");
  const { terapeutaId, sedeId } = terapeutaDe(user);

  const parsed = citaRapidaSchema.safeParse({
    pacienteNuevo: formData.get("pacienteNuevo") === "1",
    pacienteId: String(formData.get("pacienteId") ?? ""),
    nombres: String(formData.get("nombres") ?? ""),
    apellidoPaterno: String(formData.get("apellidoPaterno") ?? ""),
    telefono: String(formData.get("telefono") ?? ""),
    tipo: formData.get("tipo"),
    horaInicio: formData.get("horaInicio"),
    duracion: formData.get("duracion"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  if (d.pacienteNuevo) {
    assertPermiso(user, "PACIENTE_AL_VUELO");
    if (!d.nombres) return { error: "Indique los nombres del paciente." };
    if (!d.apellidoPaterno) return { error: "Indique el apellido paterno." };
  } else {
    if (!d.pacienteId) return { error: "Seleccione un paciente." };
    const paciente = await prisma.paciente.findFirst({
      where: { id: d.pacienteId, sedeId },
      select: { id: true },
    });
    if (!paciente) return { error: "El paciente no pertenece a su sede." };
  }

  const horaFin = sumarMinutos(d.horaInicio, d.duracion);
  if (!horaFin) return { error: "La cita no puede terminar después de medianoche." };

  const fechaCita = fechaDesdeInput(hoyLima());
  const err = await validarFranjaCita({
    sedeId,
    fecha: fechaCita,
    horaInicio: d.horaInicio,
    horaFin,
    terapeutaId,
    // Un paciente nuevo aún no tiene citas con qué chocar.
    pacienteId: d.pacienteNuevo ? "" : d.pacienteId,
    maxPacientes: 1,
  });
  if (err) return { error: err };

  const cita = await prisma.$transaction(async (tx) => {
    const pacienteId = d.pacienteNuevo
      ? (
          await tx.paciente.create({
            data: {
              sedeId,
              nombres: d.nombres,
              apellidoPaterno: d.apellidoPaterno,
              telefono: d.telefono || null,
            },
            select: { id: true },
          })
        ).id
      : d.pacienteId;
    return tx.cita.create({
      data: {
        sedeId,
        pacienteId,
        terapeutaId,
        fecha: fechaCita,
        horaInicio: d.horaInicio,
        horaFin,
        tipo: d.tipo,
      },
      select: { id: true },
    });
  });

  revalidatePath("/citas");
  revalidatePath("/panel");
  redirect(`/citas/${cita.id}`);
}

/* ── Cobro rápido de una cita (terapeuta) ─────────────── */

const cobroSchema = z.object({
  monto: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n > 0, "El monto debe ser mayor a 0."),
  metodoPago: z.enum(["EFECTIVO", "YAPE", "PLIN", "TRANSFERENCIA", "TARJETA"]),
  referencia: z.string().trim(),
});

export type CobroState = { error?: string } | undefined;

/**
 * El terapeuta con REGISTRAR_COBRO cobra una cita suya que no es de un
 * paquete (los paquetes los cobra recepción desde Pagos). Se genera el recibo
 * con la misma numeración que el módulo de pagos.
 */
export async function registrarCobroCita(
  citaId: string,
  _prev: CobroState,
  formData: FormData,
): Promise<CobroState> {
  const user = await requireUser();
  assertPermiso(user, "REGISTRAR_COBRO");
  if (!esTerapeuta(user)) return { error: "Registre el pago desde el módulo de Pagos." };

  const cita = await prisma.cita.findUnique({
    where: { id: citaId },
    select: {
      sedeId: true,
      pacienteId: true,
      terapeutaId: true,
      paqueteId: true,
      tipo: true,
      fecha: true,
      horaInicio: true,
    },
  });
  if (!cita) return { error: "Cita no encontrada." };
  await assertSedeAccess(user, cita.sedeId);
  assertCitaPropia(user, cita);
  if (cita.paqueteId) {
    return { error: "Las sesiones de un paquete se cobran desde Pagos." };
  }

  const parsed = cobroSchema.safeParse({
    monto: formData.get("monto"),
    metodoPago: formData.get("metodoPago"),
    referencia: String(formData.get("referencia") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  let numeroRecibo: string;
  try {
    ({ numeroRecibo } = await crearPagoConRecibo({
      sedeId: cita.sedeId,
      pacienteId: cita.pacienteId,
      concepto: cita.tipo === "EVALUACION" ? "EVALUACION" : "OTRO",
      descripcion: `${TIPO_LABEL[cita.tipo]} del ${fmtFecha(cita.fecha)} ${cita.horaInicio}`,
      monto: parsed.data.monto,
      metodoPago: parsed.data.metodoPago,
      referencia: parsed.data.referencia || undefined,
      fechaPago: new Date(),
    }));
  } catch {
    return { error: "No se pudo generar el recibo (intenta de nuevo)." };
  }

  revalidatePath("/pagos");
  redirect(`/citas/${citaId}?recibo=${encodeURIComponent(numeroRecibo)}`);
}
