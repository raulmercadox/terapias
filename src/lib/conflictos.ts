import type { Prisma } from "@prisma/client";
import { fecha } from "@/lib/utils";
import {
  evaluarCupo,
  type EstadoCupo,
  type TerapiaCupo,
} from "@/app/(app)/sesiones/disponibilidad";

/** Cliente Prisma o cliente de transacción (ambos exponen `.cita`). */
type DbClient = Prisma.TransactionClient;

export type CitaOcupada = {
  id: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  pacienteId: string;
  pacienteNombre: string;
};

export type FranjaCita = {
  fecha: Date;
  horaInicio: string;
  horaFin: string;
};

/**
 * Busca una sesión/cita del mismo paciente que se cruce con el rango dado.
 * Un paciente no puede estar en dos sesiones a la vez (independientemente del
 * terapeuta). Devuelve la primera cita en conflicto, o null si no hay cruce.
 */
export async function conflictoPaciente(
  db: DbClient,
  params: {
    pacienteId: string;
    fecha: Date;
    horaInicio: string;
    horaFin: string;
    exceptCitaId?: string;
  },
): Promise<FranjaCita | null> {
  const { pacienteId, fecha, horaInicio, horaFin, exceptCitaId } = params;

  const inicioDia = new Date(fecha);
  inicioDia.setHours(0, 0, 0, 0);
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);

  const candidatas = await db.cita.findMany({
    where: {
      pacienteId,
      estado: { not: "CANCELADA" },
      fecha: { gte: inicioDia, lt: finDia },
      ...(exceptCitaId ? { id: { not: exceptCitaId } } : {}),
    },
    select: { fecha: true, horaInicio: true, horaFin: true },
    orderBy: { horaInicio: "asc" },
  });

  const cruce = candidatas.find(
    (c) => horaInicio < c.horaFin && horaFin > c.horaInicio,
  );
  return cruce
    ? { fecha: cruce.fecha, horaInicio: cruce.horaInicio, horaFin: cruce.horaFin }
    : null;
}

export type CupoResultado = {
  /** Pacientes distintos (≠ nuevoPacienteId) ya asignados al terapeuta en esa franja. */
  ocupados: number;
  /** true si el paciente no puede tomar la franja con ese terapeuta. */
  excede: boolean;
  /** "ocupado" = sesión no compartible; "lleno" = grupal sin cupo. */
  estado: EstadoCupo;
  /** Una cita de ejemplo en la franja (para construir el mensaje). */
  ejemplo?: CitaOcupada;
};

/**
 * Evalúa si el terapeuta puede atender al paciente en una franja (misma fecha
 * + rango horario), con la regla de `evaluarCupo`: solo una terapia GRUPAL
 * comparte la franja, con citas de la misma terapia y el mismo horario, hasta
 * `maxParticipantes`. `terapia` null = cita suelta (franja exclusiva).
 * Considera las citas no canceladas del día, excepto `exceptCitaId`.
 */
export async function cupoTerapeuta(
  db: DbClient,
  params: {
    terapeutaId: string;
    fecha: Date;
    horaInicio: string;
    horaFin: string;
    terapia: TerapiaCupo | null;
    nuevoPacienteId?: string;
    exceptCitaId?: string;
  },
): Promise<CupoResultado> {
  const {
    terapeutaId,
    fecha,
    horaInicio,
    horaFin,
    terapia,
    nuevoPacienteId,
    exceptCitaId,
  } = params;

  // Ventana del día [medianoche, medianoche+1) en horario local.
  const inicioDia = new Date(fecha);
  inicioDia.setHours(0, 0, 0, 0);
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);

  const candidatas = await db.cita.findMany({
    where: {
      terapeutaId,
      estado: { not: "CANCELADA" },
      fecha: { gte: inicioDia, lt: finDia },
      ...(exceptCitaId ? { id: { not: exceptCitaId } } : {}),
    },
    select: {
      id: true,
      fecha: true,
      horaInicio: true,
      horaFin: true,
      pacienteId: true,
      terapiaId: true,
      paciente: { select: { nombres: true, apellidoPaterno: true } },
    },
    orderBy: { horaInicio: "asc" },
  });

  const r = evaluarCupo(candidatas, { horaInicio, horaFin }, terapia, nuevoPacienteId);
  const ej = r.ejemplo;

  return {
    ocupados: r.ocupados,
    estado: r.estado,
    excede: r.estado === "ocupado" || r.estado === "lleno",
    ejemplo: ej
      ? {
          id: ej.id,
          fecha: ej.fecha,
          horaInicio: ej.horaInicio,
          horaFin: ej.horaFin,
          pacienteId: ej.pacienteId,
          pacienteNombre:
            `${ej.paciente.nombres} ${ej.paciente.apellidoPaterno}`.trim(),
        }
      : undefined,
  };
}

/** Terapia con la forma que pide `cupoTerapeuta` (o null). */
export const SELECT_TERAPIA_CUPO = {
  id: true,
  modalidad: true,
  maxParticipantes: true,
} as const;

/** Mensaje legible cuando el terapeuta no puede tomar la franja. */
export function mensajeCupo(
  cupo: CupoResultado,
  terapia: TerapiaCupo | null,
): string {
  const ej = cupo.ejemplo;
  if (!ej) return "El terapeuta no tiene disponibilidad en esa franja.";
  const dia = fecha(ej.fecha);
  if (cupo.estado === "lleno" && terapia) {
    return `El grupo ya está completo (${terapia.maxParticipantes} participantes) el ${dia} de ${ej.horaInicio} a ${ej.horaFin}.`;
  }
  return `El terapeuta ya tiene una sesión el ${dia} de ${ej.horaInicio} a ${ej.horaFin} (${ej.pacienteNombre}).`;
}
