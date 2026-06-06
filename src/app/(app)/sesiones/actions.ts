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

  const fechaInicio = parseFecha(data.fechaInicio);
  if (!fechaInicio) return { ok: false, error: "Fecha de inicio inválida." };

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

  // Terapeuta por defecto: el de la última sesión del paquete origen (si hay).
  const ultima = await prisma.cita.findFirst({
    where: { paqueteId },
    orderBy: { numeroSesion: "desc" },
    select: { terapeutaId: true },
  });
  const terapeutaId = ultima?.terapeutaId ?? null;

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
      }),
    });
  });

  revalidatePath("/sesiones");
  redirect(`/sesiones/${nuevoId}`);
}
