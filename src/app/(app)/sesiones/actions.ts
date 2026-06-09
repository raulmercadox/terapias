"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertSedeAccess } from "@/lib/session";
import { construirSesiones, fechaFinDeSesiones } from "./schedule";

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

/**
 * Parsea un valor de `datetime-local` ("YYYY-MM-DDTHH:mm") devolviendo la fecha
 * anclada a medianoche local (las fechas de sesión se calculan sin hora) y la
 * hora como string "HH:mm". Si no trae hora, usa 09:00 por defecto.
 */
function parseFechaHora(
  value: unknown,
): { fecha: Date; horaInicio: string } | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  const fecha = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(fecha.getTime())) return null;
  const horaInicio = `${m[4] ?? "09"}:${m[5] ?? "00"}`;
  return { fecha, horaInicio };
}

/** Suma `mins` minutos a una hora "HH:mm" (mismo día; se asume duración corta). */
function sumarMinutos(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + mins) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Duración por defecto de una sesión, en minutos. */
const DURACION_SESION_MIN = 45;

/* ── crearPaquete ────────────────────────────────────────── */

const crearPaqueteSchema = z.object({
  pacienteId: z.string().min(1, "Seleccione un paciente."),
  terapeutaId: z.string().optional(),
  totalSesiones: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 sesión.")
    .max(60, "Máximo 60 sesiones."),
  frecuenciaSemana: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 por semana.")
    .max(5, "Máximo 5 por semana."),
  precio: z.coerce.number().min(0, "Precio inválido."),
  fechaInicio: z.string().min(1, "Indique la fecha de inicio."),
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

  const inicio = parseFechaHora(data.fechaInicio);
  if (!inicio) return { ok: false, error: "Fecha de inicio inválida." };
  const { fecha: fechaInicio, horaInicio } = inicio;
  const horaFin = sumarMinutos(horaInicio, DURACION_SESION_MIN);

  // El paciente debe pertenecer a la sede y estar activo.
  const paciente = await prisma.paciente.findFirst({
    where: { id: data.pacienteId, sedeId },
    select: { id: true },
  });
  if (!paciente) return { ok: false, error: "Paciente no encontrado en la sede." };

  const terapeutaId =
    data.terapeutaId && data.terapeutaId !== "" ? data.terapeutaId : null;
  if (terapeutaId) {
    const ter = await prisma.terapeuta.findFirst({
      where: { id: terapeutaId, sedeId },
      select: { id: true },
    });
    if (!ter) return { ok: false, error: "Terapeuta no encontrado en la sede." };
  }

  const fechaFin = fechaFinDeSesiones(
    fechaInicio,
    data.totalSesiones,
    data.frecuenciaSemana,
  );

  let nuevoId = "";
  await prisma.$transaction(async (tx) => {
    const paquete = await tx.paquete.create({
      data: {
        sedeId,
        pacienteId: data.pacienteId,
        totalSesiones: data.totalSesiones,
        frecuenciaSemana: data.frecuenciaSemana,
        precio: data.precio,
        fechaInicio,
        fechaFin,
        estado: "ACTIVO",
        observacion: data.observacion?.trim() || null,
      },
    });
    nuevoId = paquete.id;

    await tx.cita.createMany({
      data: construirSesiones({
        sedeId,
        pacienteId: data.pacienteId,
        paqueteId: paquete.id,
        terapeutaId,
        totalSesiones: data.totalSesiones,
        frecuenciaSemana: data.frecuenciaSemana,
        fechaInicio,
        horaInicio,
        horaFin,
      }),
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
    select: { sedeId: true, paqueteId: true },
  });
  if (!cita) return { ok: false, error: "Sesión no encontrada." };
  assertSedeAccess(user, cita.sedeId);

  const nuevaFecha = parseFecha(fecha);
  if (!nuevaFecha) return { ok: false, error: "Fecha inválida." };

  const ter = terapeutaId && terapeutaId !== "" ? terapeutaId : null;
  if (ter) {
    const existe = await prisma.terapeuta.findFirst({
      where: { id: ter, sedeId: cita.sedeId },
      select: { id: true },
    });
    if (!existe) return { ok: false, error: "Terapeuta inválido." };
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
      totalSesiones: true,
      frecuenciaSemana: true,
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

  // Terapeuta y horario por defecto: los de la última sesión del paquete origen.
  const ultima = await prisma.cita.findFirst({
    where: { paqueteId },
    orderBy: { numeroSesion: "desc" },
    select: { terapeutaId: true, horaInicio: true, horaFin: true },
  });
  const terapeutaId = ultima?.terapeutaId ?? null;
  const horaInicio = ultima?.horaInicio;
  const horaFin = ultima?.horaFin;

  // La renovación inicia hoy.
  const fechaInicio = new Date();
  fechaInicio.setHours(0, 0, 0, 0);

  const fechaFin = fechaFinDeSesiones(
    fechaInicio,
    origen.totalSesiones,
    origen.frecuenciaSemana,
  );

  let nuevoId = "";
  await prisma.$transaction(async (tx) => {
    const paquete = await tx.paquete.create({
      data: {
        sedeId: origen.sedeId,
        pacienteId: origen.pacienteId,
        totalSesiones: origen.totalSesiones,
        frecuenciaSemana: origen.frecuenciaSemana,
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
        frecuenciaSemana: origen.frecuenciaSemana,
        fechaInicio,
        horaInicio,
        horaFin,
      }),
    });
  });

  revalidatePath("/sesiones");
  redirect(`/sesiones/${nuevoId}`);
}
