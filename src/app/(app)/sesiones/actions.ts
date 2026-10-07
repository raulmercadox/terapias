"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  assertSedeAccess,
  puedeVerPagos,
  esTerapeuta,
} from "@/lib/session";

/** El terapeuta no opera paquetes: sus sesiones las atiende desde la cita. */
const SIN_PERMISO_TERAPEUTA = {
  ok: false,
  error: "No tiene permisos para esta operación.",
} as const;
import {
  construirSesiones,
  generarSesiones,
  type HorarioDia,
} from "./schedule";
import {
  cupoTerapeuta,
  conflictoPaciente,
  mensajeCupo,
  SELECT_TERAPIA_CUPO,
  type FranjaCita,
} from "@/lib/conflictos";
import type { TerapiaCupo } from "./disponibilidad";
import {
  esIntervaloValido,
  claveFecha,
  aMinutos,
  sumarMinutos,
  chocaConRefrigerio,
  refrigerioEfectivo,
  enVacaciones,
  clavesVacaciones,
  motivoFueraDeHorario,
  motivoFueraDeHorarioEnDia,
  DIA_NOMBRE,
  PASO_GRILLA_MIN,
} from "./horario";
import { fecha as fmtFecha } from "@/lib/utils";
import { plantillaSemanal } from "./renovacion";
import { paqueteRenovable, evaluacionAbierta } from "./renovable";

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

/** Mensaje legible cuando el paciente ya tiene una sesión en esa franja. */
function mensajePaciente(c: FranjaCita): string {
  return `El paciente ya tiene una sesión el ${fmtFecha(c.fecha)} de ${c.horaInicio} a ${c.horaFin}. No puede estar en dos sesiones a la vez.`;
}

/* ── crearPaquete ────────────────────────────────────────── */

const crearPaqueteSchema = z.object({
  pacienteId: z.string().min(1, "Seleccione un paciente."),
  evaluacionId: z.string().min(1, "Seleccione la evaluación del paciente."),
  // Paquete que se renueva (opcional): aplica de nuevo su evaluación.
  renovarDe: z.string().optional(),
  precio: z.coerce.number().min(0, "Precio inválido."),
  lineas: z.string().min(1, "Agende las terapias del tratamiento."),
  observacion: z.string().optional(),
});

/** Una terapia del paquete tal como llega del formulario. */
type LineaInput = { terapiaId: string; terapeutaId: string; sesiones: SesionInput[] };

function parseLineas(value: string): LineaInput[] | null {
  let arr: unknown;
  try {
    arr = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const out: LineaInput[] = [];
  for (const it of arr) {
    const o = (it ?? {}) as Record<string, unknown>;
    const sesiones = parseSesiones(JSON.stringify(o.sesiones ?? null));
    if (typeof o.terapiaId !== "string" || typeof o.terapeutaId !== "string" || !sesiones) {
      return null;
    }
    out.push({ terapiaId: o.terapiaId, terapeutaId: o.terapeutaId, sesiones });
  }
  return out;
}

/** Error de validación lanzado dentro de la transacción (se muestra tal cual). */
class ErrorAgenda extends Error {}

export async function crearPaquete(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (esTerapeuta(user)) return SIN_PERMISO_TERAPEUTA;
  const sedeId = formData.get("sedeId") as string;
  await assertSedeAccess(user, sedeId);

  const parsed = crearPaqueteSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const lineasInput = parseLineas(data.lineas);
  if (!lineasInput || lineasInput.length === 0) {
    return { ok: false, error: "Agende las terapias del tratamiento." };
  }

  // La evaluación debe ser del paciente y de la sede: de ella sale el tratamiento.
  const evaluacion = await prisma.evaluacion.findFirst({
    where: { id: data.evaluacionId, pacienteId: data.pacienteId, sedeId },
    select: { cerradaEn: true, tratamiento: { select: { terapiaId: true } } },
  });
  if (!evaluacion) {
    return { ok: false, error: "La evaluación no corresponde al paciente." };
  }
  if (evaluacion.cerradaEn) {
    return {
      ok: false,
      error: "La evaluación está cerrada: elige o registra una evaluación abierta.",
    };
  }
  if (data.renovarDe) {
    const r = await paqueteRenovable(data.renovarDe);
    if ("error" in r) return { ok: false, error: r.error };
    if (
      r.paquete.sedeId !== sedeId ||
      r.paquete.pacienteId !== data.pacienteId ||
      r.paquete.evaluacionId !== data.evaluacionId
    ) {
      return { ok: false, error: "La renovación no corresponde a este paquete." };
    }
  }
  const delTratamiento = new Set(evaluacion.tratamiento.map((t) => t.terapiaId));

  const ids = lineasInput.map((l) => l.terapiaId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Una terapia aparece dos veces en el paquete." };
  }
  if (ids.some((id) => !delTratamiento.has(id))) {
    return { ok: false, error: "Alguna terapia no está en el tratamiento de la evaluación." };
  }

  const [terapias, terapeutas, sede, feriadosRows] = await Promise.all([
    prisma.terapia.findMany({
      where: { id: { in: ids }, sedeId, activo: true },
      select: { ...SELECT_TERAPIA_CUPO, nombre: true, especialidadId: true, duracionMin: true },
    }),
    prisma.terapeuta.findMany({
      where: { id: { in: lineasInput.map((l) => l.terapeutaId) }, sedeId, activo: true },
      select: {
        id: true,
        refrigerioInicio: true,
        refrigerioFin: true,
        especialidades: { select: { especialidadId: true } },
        vacaciones: { select: { fechaInicio: true, fechaFin: true } },
      },
    }),
    prisma.sede.findUnique({
      where: { id: sedeId },
      select: {
        horaApertura: true,
        horaCierre: true,
        diasLaborales: true,
        refrigerioInicio: true,
        refrigerioFin: true,
      },
    }),
    prisma.feriado.findMany({ where: { sedeId }, select: { fecha: true } }),
  ]);
  if (!sede) return { ok: false, error: "Sede no encontrada." };
  const feriados = new Set(feriadosRows.map((f) => claveFecha(f.fecha)));

  const paciente = await prisma.paciente.findFirst({
    where: { id: data.pacienteId, sedeId },
    select: { id: true },
  });
  if (!paciente) return { ok: false, error: "Paciente no encontrado en la sede." };

  const hoyClave = claveFecha(new Date());

  // Validar y armar cada terapia con sus sesiones concretas.
  type SesionFinal = { fecha: Date; clave: string; horaInicio: string; horaFin: string };
  const lineas: {
    terapia: (typeof terapias)[number];
    terapeutaId: string;
    sesiones: SesionFinal[];
  }[] = [];
  for (const l of lineasInput) {
    const terapia = terapias.find((t) => t.id === l.terapiaId);
    if (!terapia) {
      return { ok: false, error: "Alguna terapia del tratamiento está inactiva o no existe." };
    }
    const ter = terapeutas.find((t) => t.id === l.terapeutaId);
    if (!ter) {
      return { ok: false, error: `Seleccione un terapeuta activo para ${terapia.nombre}.` };
    }
    if (
      terapia.especialidadId &&
      !ter.especialidades.some((e) => e.especialidadId === terapia.especialidadId)
    ) {
      return {
        ok: false,
        error: `El terapeuta elegido para ${terapia.nombre} no tiene su especialidad.`,
      };
    }
    if (l.sesiones.length === 0 || l.sesiones.length > 60) {
      return { ok: false, error: `${terapia.nombre}: marque de 1 a 60 sesiones.` };
    }
    // Una sola sesión por día y terapia.
    if (new Set(l.sesiones.map((s) => s.fecha)).size !== l.sesiones.length) {
      return { ok: false, error: `${terapia.nombre}: hay dos sesiones el mismo día.` };
    }

    // La duración de la sesión la define la terapia; el refrigerio propio del
    // terapeuta reemplaza al de la sede.
    const duracionMin = terapia.duracionMin;
    const refrigerio = refrigerioEfectivo(sede, ter);
    const vacaciones = ter.vacaciones.map((v) => ({
      inicio: claveFecha(v.fechaInicio),
      fin: claveFecha(v.fechaFin),
    }));

    const sesiones: SesionFinal[] = [];
    for (const s of l.sesiones) {
      if (s.fecha < hoyClave) {
        return { ok: false, error: `No se puede agendar en una fecha pasada (${s.fecha}).` };
      }
      if (feriados.has(s.fecha)) {
        return { ok: false, error: `El ${s.fecha} es feriado; elija otro día.` };
      }
      if (enVacaciones(vacaciones, s.fecha)) {
        return {
          ok: false,
          error: `El terapeuta de ${terapia.nombre} está de vacaciones el ${s.fecha}.`,
        };
      }
      const fecha = fechaDeClave(s.fecha);
      const dia = fecha.getDay();
      if (!sede.diasLaborales.includes(dia)) {
        return {
          ok: false,
          error: `El ${DIA_NOMBRE[dia]} ${s.fecha} no es laborable en esta sede.`,
        };
      }
      const horaFin = sumarMinutos(s.hora, duracionMin);
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
          duracionMin,
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
      sesiones.push({ fecha, clave: s.fecha, horaInicio: s.hora, horaFin });
    }
    sesiones.sort((a, b) =>
      a.clave === b.clave
        ? a.horaInicio.localeCompare(b.horaInicio)
        : a.clave.localeCompare(b.clave),
    );
    lineas.push({ terapia, terapeutaId: ter.id, sesiones });
  }

  // Las terapias del mismo paquete no pueden cruzarse entre sí (es el mismo paciente).
  const todas = lineas.flatMap((l) => l.sesiones);
  for (let i = 0; i < todas.length; i++) {
    for (let j = i + 1; j < todas.length; j++) {
      const a = todas[i];
      const b = todas[j];
      if (a.clave === b.clave && a.horaInicio < b.horaFin && a.horaFin > b.horaInicio) {
        return {
          ok: false,
          error: `Dos terapias se cruzan el ${a.clave} (${a.horaInicio} y ${b.horaInicio}). El paciente no puede estar en dos sesiones a la vez.`,
        };
      }
    }
  }
  const claves = todas.map((s) => s.clave).sort();
  const totalSesiones = todas.length;

  let nuevoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      // Las verificaciones van dentro de la transacción para acortar la ventana
      // en que otra reserva podría tomar la misma franja.
      for (const l of lineas) {
        for (const s of l.sesiones) {
          const pc = await conflictoPaciente(tx, {
            pacienteId: data.pacienteId,
            fecha: s.fecha,
            horaInicio: s.horaInicio,
            horaFin: s.horaFin,
          });
          if (pc) throw new ErrorAgenda(mensajePaciente(pc));

          const cupo = await cupoTerapeuta(tx, {
            terapeutaId: l.terapeutaId,
            fecha: s.fecha,
            horaInicio: s.horaInicio,
            horaFin: s.horaFin,
            terapia: l.terapia,
            nuevoPacienteId: data.pacienteId,
          });
          if (cupo.excede) {
            throw new ErrorAgenda(`${l.terapia.nombre}: ${mensajeCupo(cupo, l.terapia)}`);
          }
        }
      }

      const paquete = await tx.paquete.create({
        data: {
          sedeId,
          pacienteId: data.pacienteId,
          evaluacionId: data.evaluacionId,
          totalSesiones,
          precio: data.precio,
          fechaInicio: fechaDeClave(claves[0]),
          fechaFin: fechaDeClave(claves[claves.length - 1]),
          estado: "ACTIVO",
          observacion: data.observacion?.trim() || null,
        },
      });
      nuevoId = paquete.id;

      for (const [orden, l] of lineas.entries()) {
        const horarioSemanal = plantillaSemanal(l.sesiones);
        const linea = await tx.paqueteTerapia.create({
          data: {
            paqueteId: paquete.id,
            terapiaId: l.terapia.id,
            terapeutaId: l.terapeutaId,
            totalSesiones: l.sesiones.length,
            frecuenciaSemana: Math.max(1, horarioSemanal.length),
            horarioSemanal,
            orden,
          },
        });
        await tx.cita.createMany({
          data: l.sesiones.map((s, i) => ({
            sedeId,
            pacienteId: data.pacienteId,
            terapeutaId: l.terapeutaId,
            terapiaId: l.terapia.id,
            paqueteId: paquete.id,
            paqueteTerapiaId: linea.id,
            numeroSesion: i + 1,
            fecha: s.fecha,
            horaInicio: s.horaInicio,
            horaFin: s.horaFin,
            tipo: "SESION" as const,
            estado: "AGENDADA" as const,
            asistencia: "PENDIENTE" as const,
          })),
        });
      }
    }, { timeout: 30_000 });
  } catch (e) {
    if (e instanceof ErrorAgenda) return { ok: false, error: e.message };
    throw e;
  }

  revalidatePath("/sesiones");
  revalidatePath(`/pacientes/${data.pacienteId}`);
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
  if (esTerapeuta(user)) return SIN_PERMISO_TERAPEUTA;
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
  await assertSedeAccess(user, cita.sedeId);

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
  if (esTerapeuta(user)) return SIN_PERMISO_TERAPEUTA;
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
      terapia: { select: { ...SELECT_TERAPIA_CUPO, especialidadId: true } },
    },
  });
  if (!cita) return { ok: false, error: "Sesión no encontrada." };
  await assertSedeAccess(user, cita.sedeId);

  const nuevaFecha = parseFecha(fecha);
  if (!nuevaFecha) return { ok: false, error: "Fecha inválida." };

  const ter = terapeutaId && terapeutaId !== "" ? terapeutaId : null;
  const terapeuta = ter
    ? await prisma.terapeuta.findFirst({
        where: { id: ter, sedeId: cita.sedeId },
        select: {
          refrigerioInicio: true,
          refrigerioFin: true,
          especialidades: { select: { especialidadId: true } },
        },
      })
    : null;
  if (ter && !terapeuta) return { ok: false, error: "Terapeuta inválido." };
  const especialidad = cita.terapia?.especialidadId;
  if (
    terapeuta &&
    especialidad &&
    !terapeuta.especialidades.some((e) => e.especialidadId === especialidad)
  ) {
    return { ok: false, error: "El terapeuta no tiene la especialidad de esta terapia." };
  }

  // Reprogramar tiene que respetar el horario de la sede igual que agendar:
  // día laborable, rango de atención y refrigerio (el del terapeuta si tiene).
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
      terapeuta,
    );
    if (motivo) return { ok: false, error: motivo };
  }

  if (ter) {
    const dia = new Date(nuevaFecha);
    dia.setHours(0, 0, 0, 0);
    const vacacion = await prisma.vacacionTerapeuta.findFirst({
      where: { terapeutaId: ter, fechaInicio: { lte: dia }, fechaFin: { gte: dia } },
      select: { id: true },
    });
    if (vacacion) {
      return { ok: false, error: "El terapeuta está de vacaciones en esa fecha." };
    }
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

  if (ter) {
    // Solo una terapia grupal comparte la franja (misma terapia y horario).
    const cupo = await cupoTerapeuta(prisma, {
      terapeutaId: ter,
      fecha: nuevaFecha,
      horaInicio,
      horaFin,
      terapia: cita.terapia,
      nuevoPacienteId: cita.pacienteId,
      exceptCitaId: citaId,
    });
    if (cupo.excede) return { ok: false, error: mensajeCupo(cupo, cita.terapia) };
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
  if (esTerapeuta(user)) return SIN_PERMISO_TERAPEUTA;
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
  await assertSedeAccess(user, paquete.sedeId);

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
  if (esTerapeuta(user)) return SIN_PERMISO_TERAPEUTA;
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
  await assertSedeAccess(user, paquete.sedeId);

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
  if (esTerapeuta(user)) return SIN_PERMISO_TERAPEUTA;
  const paqueteId = formData.get("paqueteId") as string;
  if (!paqueteId) return { ok: false, error: "Paquete inválido." };

  const paquete = await prisma.paquete.findUnique({
    where: { id: paqueteId },
    select: { sedeId: true },
  });
  if (!paquete) return { ok: false, error: "Paquete no encontrado." };
  await assertSedeAccess(user, paquete.sedeId);

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

// Solo para paquetes antiguos sin evaluación cuyo paciente no tiene una
// evaluación abierta: crea un paquete nuevo con las mismas terapias, generando
// sus sesiones con el horario semanal de cada una. Si hay evaluación abierta,
// se renueva desde "Nuevo paquete" (?renovar=) aplicándola.
export async function renovarPaquete(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (esTerapeuta(user)) return SIN_PERMISO_TERAPEUTA;
  const paqueteId = formData.get("paqueteId") as string;
  if (!paqueteId) return { ok: false, error: "Paquete inválido." };

  const origen = await prisma.paquete.findUnique({
    where: { id: paqueteId },
    select: {
      sedeId: true,
      pacienteId: true,
      evaluacionId: true,
      precio: true,
      observacion: true,
      terapias: {
        orderBy: { orden: "asc" },
        select: {
          id: true,
          totalSesiones: true,
          terapia: { select: { ...SELECT_TERAPIA_CUPO, nombre: true, duracionMin: true } },
          terapeuta: {
            select: {
              id: true,
              refrigerioInicio: true,
              refrigerioFin: true,
              vacaciones: { select: { fechaInicio: true, fechaFin: true } },
            },
          },
        },
      },
    },
  });
  if (!origen) return { ok: false, error: "Paquete no encontrado." };
  await assertSedeAccess(user, origen.sedeId);
  if (origen.evaluacionId || (await evaluacionAbierta(origen.pacienteId))) {
    return { ok: false, error: "Este paquete se renueva desde la evaluación del paciente." };
  }

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
  if (origen.terapias.length === 0) {
    return { ok: false, error: "El paquete no tiene terapias para renovar." };
  }

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

  // La renovación inicia hoy.
  const fechaInicio = new Date();
  fechaInicio.setHours(0, 0, 0, 0);

  // Feriados de la sede (desde hoy): se saltan al generar.
  const feriadosRows = await prisma.feriado.findMany({
    where: { sedeId: origen.sedeId, fecha: { gte: fechaInicio } },
    select: { fecha: true },
  });
  const feriadosSede = feriadosRows.map((f) => claveFecha(f.fecha));

  type LineaRenovada = {
    terapiaId: string | null;
    terapia: TerapiaCupo | null;
    nombre: string;
    terapeutaId: string | null;
    totalSesiones: number;
    horario: HorarioDia[];
    duracionMin: number;
    feriados: Set<string>;
    sesiones: { fecha: Date; horaInicio: string; horaFin: string }[];
  };
  const lineas: LineaRenovada[] = [];

  for (const l of origen.terapias) {
    const nombre = l.terapia?.nombre ?? "la terapia";
    // Reconstruye el horario semanal a partir de las sesiones de la terapia
    // (funciona también para paquetes antiguos sin plantilla).
    const citasOrigen = await prisma.cita.findMany({
      where: { paqueteTerapiaId: l.id, tipo: "SESION" },
      orderBy: { numeroSesion: "asc" },
      select: { fecha: true, horaInicio: true, horaFin: true },
    });
    if (citasOrigen.length === 0) {
      return { ok: false, error: `${nombre}: no tiene sesiones para renovar.` };
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

    // Duración vigente de la terapia; sin terapia, la de la primera sesión.
    const terapeuta = l.terapeuta;
    const primera = citasOrigen[0];
    const duracionMin =
      l.terapia?.duracionMin ??
      (Math.max(0, aMinutos(primera.horaFin) - aMinutos(primera.horaInicio)) || 45);

    if (sedeRenovacion) {
      for (const h of horario) {
        const motivo = motivoFueraDeHorarioEnDia(
          sedeRenovacion,
          h.dia,
          h.horaInicio,
          sumarMinutos(h.horaInicio, duracionMin),
          terapeuta,
        );
        if (motivo) {
          return {
            ok: false,
            error: `No se puede renovar ${nombre} con su horario (${DIA_NOMBRE[h.dia]} ${h.horaInicio}). ${motivo} Créelo desde “Nuevo paquete” con otro horario.`,
          };
        }
      }
    }

    // Los días de vacaciones del terapeuta también se saltan, igual que los
    // feriados. El tope cubre de sobra cualquier paquete.
    const feriados = new Set(feriadosSede);
    const tope = new Date(fechaInicio);
    tope.setDate(tope.getDate() + (l.totalSesiones + 60) * 7);
    for (const clave of clavesVacaciones(terapeuta?.vacaciones ?? [], fechaInicio, tope)) {
      feriados.add(clave);
    }

    const sesiones = generarSesiones({
      totalSesiones: l.totalSesiones,
      horario,
      duracionMin,
      fechaInicio,
      feriados,
    });
    if (sesiones.length === 0) {
      return { ok: false, error: `${nombre}: no se pudieron generar las sesiones.` };
    }
    lineas.push({
      terapiaId: l.terapia?.id ?? null,
      terapia: l.terapia,
      nombre,
      terapeutaId: terapeuta?.id ?? null,
      totalSesiones: l.totalSesiones,
      horario,
      duracionMin,
      feriados,
      sesiones,
    });
  }

  // Las terapias renovadas no pueden cruzarse entre sí (mismo paciente).
  const todas = lineas.flatMap((l) => l.sesiones);
  for (let i = 0; i < todas.length; i++) {
    for (let j = i + 1; j < todas.length; j++) {
      const a = todas[i];
      const b = todas[j];
      if (
        claveFecha(a.fecha) === claveFecha(b.fecha) &&
        a.horaInicio < b.horaFin &&
        a.horaFin > b.horaInicio
      ) {
        return {
          ok: false,
          error: `Al renovar, dos terapias se cruzan el ${fmtFecha(a.fecha)} (${a.horaInicio} y ${b.horaInicio}). Créelo desde “Nuevo paquete”.`,
        };
      }
    }
  }
  const fechas = todas.map((s) => s.fecha.getTime());
  const fechaFin = new Date(Math.max(...fechas));

  let nuevoId = "";
  try {
    await prisma.$transaction(async (tx) => {
      // Bloquear si el paciente ya tiene otra sesión solapada o el terapeuta
      // heredado ya no tiene la franja libre.
      for (const l of lineas) {
        for (const s of l.sesiones) {
          const pc = await conflictoPaciente(tx, {
            pacienteId: origen.pacienteId,
            fecha: s.fecha,
            horaInicio: s.horaInicio,
            horaFin: s.horaFin,
          });
          if (pc) throw new ErrorAgenda(mensajePaciente(pc));

          if (l.terapeutaId) {
            const cupo = await cupoTerapeuta(tx, {
              terapeutaId: l.terapeutaId,
              fecha: s.fecha,
              horaInicio: s.horaInicio,
              horaFin: s.horaFin,
              terapia: l.terapia,
              nuevoPacienteId: origen.pacienteId,
            });
            if (cupo.excede) {
              throw new ErrorAgenda(`${l.nombre}: ${mensajeCupo(cupo, l.terapia)}`);
            }
          }
        }
      }

      const paquete = await tx.paquete.create({
        data: {
          sedeId: origen.sedeId,
          pacienteId: origen.pacienteId,
          evaluacionId: origen.evaluacionId,
          totalSesiones: todas.length,
          precio: origen.precio,
          fechaInicio,
          fechaFin,
          estado: "ACTIVO",
          observacion: origen.observacion,
        },
      });
      nuevoId = paquete.id;

      for (const [orden, l] of lineas.entries()) {
        const linea = await tx.paqueteTerapia.create({
          data: {
            paqueteId: paquete.id,
            terapiaId: l.terapiaId,
            terapeutaId: l.terapeutaId,
            totalSesiones: l.totalSesiones,
            frecuenciaSemana: l.horario.length,
            horarioSemanal: l.horario.map((h) => ({ dia: h.dia, hora: h.horaInicio })),
            orden,
          },
        });
        await tx.cita.createMany({
          data: construirSesiones({
            sedeId: origen.sedeId,
            pacienteId: origen.pacienteId,
            paqueteId: paquete.id,
            paqueteTerapiaId: linea.id,
            terapeutaId: l.terapeutaId,
            terapiaId: l.terapiaId,
            totalSesiones: l.totalSesiones,
            horario: l.horario,
            duracionMin: l.duracionMin,
            fechaInicio,
            feriados: l.feriados,
          }),
        });
      }
    }, { timeout: 30_000 });
  } catch (e) {
    if (e instanceof ErrorAgenda) return { ok: false, error: e.message };
    throw e;
  }

  revalidatePath("/sesiones");
  redirect(`/sesiones/${nuevoId}`);
}
