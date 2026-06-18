import type { Prisma } from "@prisma/client";

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
  /** true si agregar al paciente superaría `maxPacientes`. */
  excede: boolean;
  /** Una cita de ejemplo en la franja (para construir el mensaje). */
  ejemplo?: CitaOcupada;
};

/**
 * Evalúa el cupo de un terapeuta en una franja (misma fecha + rango horario).
 *
 * En el centro un terapeuta puede dirigir un programa con varios pacientes en
 * la misma franja (distintos ambientes), hasta `maxPacientes` (cupo del
 * programa). Cuenta los pacientes DISTINTOS ya asignados al terapeuta cuyas
 * citas se cruzan con [horaInicio, horaFin) ese día (estado != CANCELADA),
 * excluyendo opcionalmente una cita (`exceptCitaId`). El paciente que se va a
 * asignar (`nuevoPacienteId`) se suma una sola vez; hay exceso si el total de
 * pacientes distintos supera `maxPacientes`.
 *
 * Solapamiento = aInicio < bFin && aFin > bInicio (comparación lexicográfica de
 * "HH:mm", válida con formato 24h y ceros a la izquierda).
 */
export async function cupoTerapeuta(
  db: DbClient,
  params: {
    terapeutaId: string;
    fecha: Date;
    horaInicio: string;
    horaFin: string;
    maxPacientes: number;
    nuevoPacienteId?: string;
    exceptCitaId?: string;
  },
): Promise<CupoResultado> {
  const {
    terapeutaId,
    fecha,
    horaInicio,
    horaFin,
    maxPacientes,
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
      paciente: { select: { nombres: true, apellidoPaterno: true } },
    },
    orderBy: { horaInicio: "asc" },
  });

  const cruces = candidatas.filter(
    (c) => horaInicio < c.horaFin && horaFin > c.horaInicio,
  );

  // Pacientes distintos ya en la franja, sin contar al propio paciente nuevo.
  const otros = new Set<string>();
  for (const c of cruces) {
    if (nuevoPacienteId && c.pacienteId === nuevoPacienteId) continue;
    otros.add(c.pacienteId);
  }

  const total = otros.size + (nuevoPacienteId ? 1 : 0);
  const primera = cruces[0];

  return {
    ocupados: otros.size,
    excede: total > maxPacientes,
    ejemplo: primera
      ? {
          id: primera.id,
          fecha: primera.fecha,
          horaInicio: primera.horaInicio,
          horaFin: primera.horaFin,
          pacienteId: primera.pacienteId,
          pacienteNombre:
            `${primera.paciente.nombres} ${primera.paciente.apellidoPaterno}`.trim(),
        }
      : undefined,
  };
}
