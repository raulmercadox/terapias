import type { Prisma } from "@prisma/client";

/** Cliente Prisma o cliente de transacción (ambos exponen `.cita`). */
type DbClient = Prisma.TransactionClient;

export type CitaConflicto = {
  id: string;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  pacienteNombre: string;
};

/**
 * Busca una cita del mismo terapeuta que se cruce con el rango dado.
 * Solapamiento = mismo terapeuta, misma fecha (día), estado != CANCELADA y
 * rangos de hora que se cruzan (aInicio < bFin && aFin > bInicio; comparación
 * lexicográfica de "HH:mm", válida con formato de 24h y ceros a la izquierda).
 *
 * Devuelve la primera cita en conflicto, o null si no hay cruce.
 */
export async function conflictoTerapeuta(
  db: DbClient,
  params: {
    terapeutaId: string;
    fecha: Date;
    horaInicio: string;
    horaFin: string;
    exceptCitaId?: string;
  },
): Promise<CitaConflicto | null> {
  const { terapeutaId, fecha, horaInicio, horaFin, exceptCitaId } = params;

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
      paciente: {
        select: {
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      },
    },
    orderBy: { horaInicio: "asc" },
  });

  const cruce = candidatas.find(
    (c) => horaInicio < c.horaFin && horaFin > c.horaInicio,
  );
  if (!cruce) return null;

  return {
    id: cruce.id,
    fecha: cruce.fecha,
    horaInicio: cruce.horaInicio,
    horaFin: cruce.horaFin,
    pacienteNombre:
      `${cruce.paciente.nombres} ${cruce.paciente.apellidoPaterno}`.trim(),
  };
}
