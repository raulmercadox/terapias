"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertSedeAccess, puedeVerPagos } from "@/lib/session";
import {
  construirSesiones,
  generarSesiones,
  type HorarioDia,
} from "./schedule";
import {
  cupoTerapeuta,
  conflictoPaciente,
  type CitaOcupada,
  type FranjaCita,
} from "@/lib/conflictos";
import {
  esIntervaloValido,
  claveFecha,
  aMinutos,
  sumarMinutos,
  chocaConRefrigerio,
  refrigerioDe,
  motivoFueraDeHorario,
  motivoFueraDeHorarioEnDia,
  DIA_NOMBRE,
  PASO_GRILLA_MIN,
} from "./horario";
import { fecha as fmtFecha } from "@/lib/utils";

export type ActionState = { ok: boolean; error?: string };

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ── Helpers ─────────────────────────────────────────────── */

function parseFecha(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  // input type="date" -> "YYYY-MM-DD"; lo anclamos a medianoche local.
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Una sesión concreta elegida en el calendario: fecha "YYYY-MM-DD" + hora. */
type SesionInput = { fecha: string; hora: string };

/**
 * Parsea las sesiones serializadas por el formulario: JSON con entradas
 * `{ fecha: "YYYY-MM-DD", hora: "HH:mm" }`. El usuario marca cada sesión en una
 * fecha concreta (ya no es un patrón semanal que se repite). Devuelve null si el
 * formato es inválido.
 */
function parseSesiones(value: unknown): SesionInput[] | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const out: SesionInput[] = [];
  for (const it of arr) {
    const fecha = String((it as { fecha?: unknown })?.fecha ?? "");
    const hora = String((it as { hora?: unknown })?.hora ?? "");
    if (!FECHA_RE.test(fecha)) return null;
    if (!HORA_RE.test(hora)) return null;
    out.push({ fecha, hora });
  }
  return out;
}

/** "YYYY-MM-DD" → Date a medianoche local (convención del resto del sistema). */
function fechaDeClave(clave: string): Date {
  const [y, m, d] = clave.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Mensaje legible cuando el terapeuta no tiene cupo en una franja. */
function mensajeCupo(max: number, ej: CitaOcupada): string {
  if (max <= 1) {
    return `El terapeuta ya tiene una sesión el ${fmtFecha(ej.fecha)} de ${ej.horaInicio} a ${ej.horaFin} (${ej.pacienteNombre}).`;
  }
  return `El terapeuta ya alcanzó el cupo máximo (${max}) el ${fmtFecha(ej.fecha)} de ${ej.horaInicio} a ${ej.horaFin}.`;
}

/** Mensaje legible cuando el paciente ya tiene una sesión en esa franja. */
function mensajePaciente(c: FranjaCita): string {
  return `El paciente ya tiene una sesión el ${fmtFecha(c.fecha)} de ${c.horaInicio} a ${c.horaFin}. No puede estar en dos sesiones a la vez.`;
}

/* ── crearPaquete ────────────────────────────────────────── */

const crearPaqueteSchema = z.object({
  pacienteId: z.string().min(1, "Seleccione un paciente."),
  programaId: z.string().min(1, "Seleccione un programa."),
  terapeutaId: z.string().min(1, "Seleccione un terapeuta."),
  totalSesiones: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 sesión.")
    .max(60, "Máximo 60 sesiones."),
  precio: z.coerce.number().min(0, "Precio inválido."),
  sesiones: z.string().min(1, "Marque las sesiones en el calendario."),
  observacion: z.string().optional(),
});

export async function crearPaquete(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const sedeId = formData.get("sedeId") as string;
  assertSedeAccess(user, sedeId);

  const parsed = crearPaqueteSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const sesionesInput = parseSesiones(data.sesiones);
  if (!sesionesInput || sesionesInput.length === 0) {
    return { ok: false, error: "Marque las sesiones en el calendario." };
  }

  // Una sola sesión por día (no se pueden marcar dos en la misma fecha).
  const clavesVistas = new Set<string>();
  for (const s of sesionesInput) {
    if (clavesVistas.has(s.fecha)) {
      return { ok: false, error: "Hay sesiones repetidas en el mismo día." };
    }
    clavesVistas.add(s.fecha);
  }

  // Debe marcarse exactamente la cantidad indicada en "Total de sesiones".
  if (sesionesInput.length !== data.totalSesiones) {
    return {
      ok: false,
      error: `Debe marcar exactamente ${data.totalSesiones} sesión(es) en el calendario; marcó ${sesionesInput.length}.`,
    };
  }

  // El paciente debe pertenecer a la sede.
  const paciente = await prisma.paciente.findFirst({
    where: { id: data.pacienteId, sedeId },
    select: { id: true },
  });
  if (!paciente) return { ok: false, error: "Paciente no encontrado en la sede." };

  // El programa debe pertenecer a la sede y estar activo (define la duración).
  const programa = await prisma.programaTerapia.findFirst({
    where: { id: data.programaId, sedeId, activo: true },
    select: { duracionMin: true, maxPacientes: true },
  });
  if (!programa) {
    return { ok: false, error: "Programa no encontrado o inactivo en la sede." };
  }

  // Configuración de la sede (horario laboral).
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
  if (!sede) return { ok: false, error: "Sede no encontrada." };
  const refrigerio = refrigerioDe(sede.refrigerioInicio, sede.refrigerioFin);

  const terapeutaId = data.terapeutaId;
  const ter = await prisma.terapeuta.findFirst({
    where: { id: terapeutaId, sedeId },
    select: { id: true },
  });
  if (!ter) return { ok: false, error: "Terapeuta no encontrado en la sede." };

  // Feriados de la sede (para rechazar sesiones en esos días).
  const feriadosRows = await prisma.feriado.findMany({
    where: { sedeId },
    select: { fecha: true },
  });
  const feriados = new Set(feriadosRows.map((f) => claveFecha(f.fecha)));

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hoyClave = claveFecha(hoy);

  // Validar y armar cada sesión concreta.
  type SesionFinal = { fecha: Date; horaInicio: string; horaFin: string };
  const finales: SesionFinal[] = [];
  for (const s of sesionesInput) {
    if (s.fecha < hoyClave) {
      return { ok: false, error: `No se puede agendar en una fecha pasada (${s.fecha}).` };
    }
    if (feriados.has(s.fecha)) {
      return { ok: false, error: `El ${s.fecha} es feriado; elija otro día.` };
    }
    const fecha = fechaDeClave(s.fecha);
    const dia = fecha.getDay();
    if (!sede.diasLaborales.includes(dia)) {
      return {
        ok: false,
        error: `El ${DIA_NOMBRE[dia]} ${s.fecha} no es laborable en esta sede.`,
      };
    }
    const horaFin = sumarMinutos(s.hora, programa.duracionMin);
    if (chocaConRefrigerio(s.hora, horaFin, refrigerio)) {
      return {
        ok: false,
        error: `La sesión de las ${s.hora} (${s.fecha}) se cruza con el refrigerio de ${refrigerio!.inicio} a ${refrigerio!.fin}.`,
      };
    }
    if (
      !esIntervaloValido(
        sede.horaApertura,
        sede.horaCierre,
        programa.duracionMin,
        s.hora,
        PASO_GRILLA_MIN,
        refrigerio,
      )
    ) {
      return {
        ok: false,
        error: `La hora ${s.hora} (${s.fecha}) no es un intervalo válido del horario de atención.`,
      };
    }
    finales.push({ fecha, horaInicio: s.hora, horaFin });
  }

  // Orden cronológico para numerar y calcular inicio/fin.
  finales.sort((a, b) => {
    const fa = claveFecha(a.fecha);
    const fb = claveFecha(b.fecha);
    return fa === fb ? a.horaInicio.localeCompare(b.horaInicio) : fa.localeCompare(fb);
  });
  const fechaInicio = finales[0].fecha;
  const fechaFin = finales[finales.length - 1].fecha;

  // Bloquear si el paciente ya tiene otra sesión solapada o el terapeuta ya
  // superó su cupo en alguna de las franjas.
  for (const s of finales) {
    const pc = await conflictoPaciente(prisma, {
      pacienteId: data.pacienteId,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
    });
    if (pc) return { ok: false, error: mensajePaciente(pc) };

    const cupo = await cupoTerapeuta(prisma, {
      terapeutaId,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      maxPacientes: programa.maxPacientes,
      nuevoPacienteId: data.pacienteId,
    });
    if (cupo.excede && cupo.ejemplo) {
      return { ok: false, error: mensajeCupo(programa.maxPacientes, cupo.ejemplo) };
    }
  }

  // Plantilla semanal (primer horario visto por día) para la renovación.
  const porDia = new Map<number, string>();
  for (const s of finales) {
    const dia = s.fecha.getDay();
    if (!porDia.has(dia)) porDia.set(dia, s.horaInicio);
  }
  const horarioSemanal = [...porDia.entries()].map(([dia, hora]) => ({ dia, hora }));

  let nuevoId = "";
  await prisma.$transaction(async (tx) => {
    const paquete = await tx.paquete.create({
      data: {
        sedeId,
        pacienteId: data.pacienteId,
        programaId: data.programaId,
        totalSesiones: data.totalSesiones,
        frecuenciaSemana: Math.max(1, porDia.size),
        horarioSemanal,
        precio: data.precio,
        fechaInicio,
        fechaFin,
        estado: "ACTIVO",
        observacion: data.observacion?.trim() || null,
      },
    });
    nuevoId = paquete.id;

    await tx.cita.createMany({
      data: finales.map((s, i) => ({
        sedeId,
        pacienteId: data.pacienteId,
        terapeutaId,
        paqueteId: paquete.id,
        numeroSesion: i + 1,
        fecha: s.fecha,
        horaInicio: s.horaInicio,
        horaFin: s.horaFin,
        tipo: "SESION" as const,
        estado: "AGENDADA" as const,
        asistencia: "PENDIENTE" as const,
      })),
    });
  });

  revalidatePath("/sesiones");
  redirect(`/sesiones/${nuevoId}`);
}

/* ── registrarAsistencia ─────────────────────────────────── */

const registrarAsistenciaSchema = z.object({
  citaId: z.string().min(1),
  asistencia: z.enum(["ASISTIO", "FALTO", "TARDANZA"]),
  terapiaRealizada: z.string().optional(),
  observacion: z.string().optional(),
});

export async function registrarAsistencia(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = registrarAsistenciaSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { citaId, asistencia, terapiaRealizada, observacion } = parsed.data;

  const cita = await prisma.cita.findUnique({
    where: { id: citaId },
    select: { sedeId: true, paqueteId: true },
  });
  if (!cita) return { ok: false, error: "Sesión no encontrada." };
  assertSedeAccess(user, cita.sedeId);

  // ASISTIO/TARDANZA -> sesión atendida; FALTO -> cancelada para esa cita.
  const estado = asistencia === "FALTO" ? "CANCELADA" : "ATENDIDA";

  await prisma.cita.update({
    where: { id: citaId },
    data: {
      asistencia,
      estado,
      terapiaRealizada: terapiaRealizada?.trim() || null,
      observacion: observacion?.trim() || null,
    },
  });

  if (cita.paqueteId) revalidatePath(`/sesiones/${cita.paqueteId}`);
  revalidatePath("/sesiones");
  return { ok: true };
}

/* ── reprogramarSesion ───────────────────────────────────── */

const reprogramarSchema = z.object({
  citaId: z.string().min(1),
  fecha: z.string().min(1, "Indique la fecha."),
  horaInicio: z.string().regex(HORA_RE, "Hora inicio inválida."),
  horaFin: z.string().regex(HORA_RE, "Hora fin inválida."),
  terapeutaId: z.string().optional(),
});

export async function reprogramarSesion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reprogramarSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { citaId, fecha, horaInicio, horaFin, terapeutaId } = parsed.data;

  const cita = await prisma.cita.findUnique({
    where: { id: citaId },
    select: {
      sedeId: true,
      paqueteId: true,
      pacienteId: true,
      paquete: { select: { programa: { select: { maxPacientes: true } } } },
    },
  });
  if (!cita) return { ok: false, error: "Sesión no encontrada." };
  assertSedeAccess(user, cita.sedeId);

  const nuevaFecha = parseFecha(fecha);
  if (!nuevaFecha) return { ok: false, error: "Fecha inválida." };

  // Reprogramar tiene que respetar el horario de la sede igual que agendar:
  // día laborable, rango de atención y refrigerio.
  const sedeCita = await prisma.sede.findUnique({
    where: { id: cita.sedeId },
    select: {
      horaApertura: true,
      horaCierre: true,
      diasLaborales: true,
      refrigerioInicio: true,
      refrigerioFin: true,
    },
  });
  if (sedeCita) {
    const motivo = motivoFueraDeHorario(
      sedeCita,
      nuevaFecha,
      horaInicio,
      horaFin,
    );
    if (motivo) return { ok: false, error: motivo };
  }

  // El paciente no puede quedar con dos sesiones solapadas.
  const pc = await conflictoPaciente(prisma, {
    pacienteId: cita.pacienteId,
    fecha: nuevaFecha,
    horaInicio,
    horaFin,
    exceptCitaId: citaId,
  });
  if (pc) return { ok: false, error: mensajePaciente(pc) };

  const ter = terapeutaId && terapeutaId !== "" ? terapeutaId : null;
  if (ter) {
    const existe = await prisma.terapeuta.findFirst({
      where: { id: ter, sedeId: cita.sedeId },
      select: { id: true },
    });
    if (!existe) return { ok: false, error: "Terapeuta inválido." };

    // Cupo del programa (1 = individual; >1 = grupal). Sin paquete/programa: 1.
    const maxPacientes = cita.paquete?.programa?.maxPacientes ?? 1;
    const cupo = await cupoTerapeuta(prisma, {
      terapeutaId: ter,
      fecha: nuevaFecha,
      horaInicio,
      horaFin,
      maxPacientes,
      nuevoPacienteId: cita.pacienteId,
      exceptCitaId: citaId,
    });
    if (cupo.excede && cupo.ejemplo) {
      return { ok: false, error: mensajeCupo(maxPacientes, cupo.ejemplo) };
    }
  }

  await prisma.cita.update({
    where: { id: citaId },
    data: {
      fecha: nuevaFecha,
      horaInicio,
      horaFin,
      terapeutaId: ter,
    },
  });

  if (cita.paqueteId) revalidatePath(`/sesiones/${cita.paqueteId}`);
  revalidatePath("/sesiones");
  return { ok: true };
}

/* ── actualizarPaquete ───────────────────────────────────── */

const actualizarPaqueteSchema = z.object({
  paqueteId: z.string().min(1),
  precio: z.coerce.number().min(0, "Precio inválido."),
  observacion: z.string().optional(),
});

export async function actualizarPaquete(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  // Editar el precio es una operación sobre montos: no la hace el rol USUARIO.
  if (!puedeVerPagos(user)) {
    return { ok: false, error: "No tiene permisos para esta operación." };
  }
  const parsed = actualizarPaqueteSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { paqueteId, precio, observacion } = parsed.data;

  const paquete = await prisma.paquete.findUnique({
    where: { id: paqueteId },
    select: { sedeId: true },
  });
  if (!paquete) return { ok: false, error: "Paquete no encontrado." };
  assertSedeAccess(user, paquete.sedeId);

  await prisma.paquete.update({
    where: { id: paqueteId },
    data: { precio, observacion: observacion?.trim() || null },
  });

  revalidatePath(`/sesiones/${paqueteId}`);
  revalidatePath("/sesiones");
  return { ok: true };
}

/* ── cambiarEstadoPaquete ────────────────────────────────── */

const cambiarEstadoSchema = z.object({
  paqueteId: z.string().min(1),
  estado: z.enum(["ACTIVO", "COMPLETADO", "VENCIDO", "ANULADO"]),
});

export async function cambiarEstadoPaquete(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = cambiarEstadoSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { paqueteId, estado } = parsed.data;

  const paquete = await prisma.paquete.findUnique({
    where: { id: paqueteId },
    select: {
      sedeId: true,
      totalSesiones: true,
      _count: { select: { citas: true } },
      citas: { select: { asistencia: true } },
    },
  });
  if (!paquete) return { ok: false, error: "Paquete no encontrado." };
  assertSedeAccess(user, paquete.sedeId);

  // Para COMPLETAR exigimos que todas las sesiones tengan asistencia registrada.
  if (estado === "COMPLETADO") {
    const pendientes = paquete.citas.filter(
      (c) => c.asistencia === "PENDIENTE",
    ).length;
    if (pendientes > 0) {
      return {
        ok: false,
        error: `Aún hay ${pendientes} sesión(es) sin asistencia registrada.`,
      };
    }
  }

  await prisma.paquete.update({
    where: { id: paqueteId },
    data: { estado },
  });

  revalidatePath(`/sesiones/${paqueteId}`);
  revalidatePath("/sesiones");
  return { ok: true };
}

/* ── anularPaquete ───────────────────────────────────────── */

export async function anularPaquete(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const paqueteId = formData.get("paqueteId") as string;
  if (!paqueteId) return { ok: false, error: "Paquete inválido." };

  const paquete = await prisma.paquete.findUnique({
    where: { id: paqueteId },
    select: { sedeId: true },
  });
  if (!paquete) return { ok: false, error: "Paquete no encontrado." };
  assertSedeAccess(user, paquete.sedeId);

  // Anula el paquete y cancela las sesiones aún pendientes (no atendidas).
  await prisma.$transaction([
    prisma.cita.updateMany({
      where: { paqueteId, asistencia: "PENDIENTE" },
      data: { estado: "CANCELADA" },
    }),
    prisma.paquete.update({
      where: { id: paqueteId },
      data: { estado: "ANULADO" },
    }),
  ]);

  revalidatePath(`/sesiones/${paqueteId}`);
  revalidatePath("/sesiones");
  return { ok: true };
}

/* ── renovarPaquete ──────────────────────────────────────── */

// Crea un paquete nuevo idéntico para el mismo paciente, generando sus sesiones.
export async function renovarPaquete(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const paqueteId = formData.get("paqueteId") as string;
  if (!paqueteId) return { ok: false, error: "Paquete inválido." };

  const origen = await prisma.paquete.findUnique({
    where: { id: paqueteId },
    select: {
      sedeId: true,
      pacienteId: true,
      programaId: true,
      totalSesiones: true,
      precio: true,
      observacion: true,
    },
  });
  if (!origen) return { ok: false, error: "Paquete no encontrado." };
  assertSedeAccess(user, origen.sedeId);

  // Solo se puede renovar si TODAS las sesiones del paquete actual ya tienen
  // asistencia registrada (no quedan pendientes). Evita crear un paquete nuevo
  // sin haber culminado el anterior.
  const pendientes = await prisma.cita.count({
    where: { paqueteId, tipo: "SESION", asistencia: "PENDIENTE" },
  });
  if (pendientes > 0) {
    return {
      ok: false,
      error: `No puedes renovar: aún hay ${pendientes} sesión(es) sin asistencia registrada en este paquete.`,
    };
  }

  // Reconstruye el horario semanal y la duración a partir de las sesiones del
  // paquete origen (funciona también para paquetes antiguos sin plantilla).
  const citasOrigen = await prisma.cita.findMany({
    where: { paqueteId, tipo: "SESION" },
    orderBy: { numeroSesion: "asc" },
    select: { fecha: true, horaInicio: true, horaFin: true, terapeutaId: true },
  });
  if (citasOrigen.length === 0) {
    return { ok: false, error: "El paquete no tiene sesiones para renovar." };
  }

  const porDia = new Map<number, string>();
  for (const c of citasOrigen) {
    const d = c.fecha.getDay();
    if (!porDia.has(d)) porDia.set(d, c.horaInicio);
  }
  const horario: HorarioDia[] = [...porDia.entries()].map(([dia, horaInicio]) => ({
    dia,
    horaInicio,
  }));

  const primera = citasOrigen[0];
  const duracionMin =
    Math.max(0, aMinutos(primera.horaFin) - aMinutos(primera.horaInicio)) || 45;

  // El horario heredado pudo dejar de ser válido si la sede cambió su
  // configuración después de crear el paquete original. Se valida la plantilla
  // semanal y no cada fecha: la franja se repite, así que saltarla (como se
  // hace con los feriados) dejaría el paquete corto sin avisar. Mejor negarse
  // y decir qué franja hay que mover.
  const sedeRenovacion = await prisma.sede.findUnique({
    where: { id: origen.sedeId },
    select: {
      horaApertura: true,
      horaCierre: true,
      diasLaborales: true,
      refrigerioInicio: true,
      refrigerioFin: true,
    },
  });
  if (sedeRenovacion) {
    for (const h of horario) {
      const motivo = motivoFueraDeHorarioEnDia(
        sedeRenovacion,
        h.dia,
        h.horaInicio,
        sumarMinutos(h.horaInicio, duracionMin),
      );
      if (motivo) {
        return {
          ok: false,
          error: `No se puede renovar con el horario del paquete (${DIA_NOMBRE[h.dia]} ${h.horaInicio}). ${motivo} Créelo desde “Nuevo paquete” con otro horario.`,
        };
      }
    }
  }

  // Cupo del programa (1 = individual; >1 = grupal). Paquetes antiguos: 1.
  let maxPacientes = 1;
  if (origen.programaId) {
    const prog = await prisma.programaTerapia.findUnique({
      where: { id: origen.programaId },
      select: { maxPacientes: true },
    });
    maxPacientes = prog?.maxPacientes ?? 1;
  }

  // Terapeuta por defecto: el de la última sesión del paquete origen.
  const terapeutaId = citasOrigen[citasOrigen.length - 1].terapeutaId ?? null;

  // La renovación inicia hoy.
  const fechaInicio = new Date();
  fechaInicio.setHours(0, 0, 0, 0);

  // Feriados de la sede (desde hoy): se saltan al generar.
  const feriadosRows = await prisma.feriado.findMany({
    where: { sedeId: origen.sedeId, fecha: { gte: fechaInicio } },
    select: { fecha: true },
  });
  const feriados = new Set(feriadosRows.map((f) => claveFecha(f.fecha)));

  const generadas = generarSesiones({
    totalSesiones: origen.totalSesiones,
    horario,
    duracionMin,
    fechaInicio,
    feriados,
  });
  if (generadas.length === 0) {
    return { ok: false, error: "No se pudieron generar las sesiones de la renovación." };
  }
  const fechaFin = generadas[generadas.length - 1].fecha;

  // Bloquear si el paciente ya tiene otra sesión solapada o el terapeuta
  // heredado ya superó su cupo en alguna franja.
  for (const s of generadas) {
    const pc = await conflictoPaciente(prisma, {
      pacienteId: origen.pacienteId,
      fecha: s.fecha,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
    });
    if (pc) return { ok: false, error: mensajePaciente(pc) };

    if (terapeutaId) {
      const cupo = await cupoTerapeuta(prisma, {
        terapeutaId,
        fecha: s.fecha,
        horaInicio: s.horaInicio,
        horaFin: s.horaFin,
        maxPacientes,
        nuevoPacienteId: origen.pacienteId,
      });
      if (cupo.excede && cupo.ejemplo) {
        return { ok: false, error: mensajeCupo(maxPacientes, cupo.ejemplo) };
      }
    }
  }

  let nuevoId = "";
  await prisma.$transaction(async (tx) => {
    const paquete = await tx.paquete.create({
      data: {
        sedeId: origen.sedeId,
        pacienteId: origen.pacienteId,
        programaId: origen.programaId,
        totalSesiones: origen.totalSesiones,
        frecuenciaSemana: horario.length,
        horarioSemanal: horario.map((h) => ({ dia: h.dia, hora: h.horaInicio })),
        precio: origen.precio,
        fechaInicio,
        fechaFin,
        estado: "ACTIVO",
        observacion: origen.observacion,
      },
    });
    nuevoId = paquete.id;

    await tx.cita.createMany({
      data: construirSesiones({
        sedeId: origen.sedeId,
        pacienteId: origen.pacienteId,
        paqueteId: paquete.id,
        terapeutaId,
        totalSesiones: origen.totalSesiones,
        horario,
        duracionMin,
        fechaInicio,
        feriados,
      }),
    });
  });

  revalidatePath("/sesiones");
  redirect(`/sesiones/${nuevoId}`);
}
