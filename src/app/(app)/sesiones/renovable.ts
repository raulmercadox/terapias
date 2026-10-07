import { prisma } from "@/lib/prisma";
import { plantillaSemanal, type DiaPlantilla } from "./renovacion";

/** Lo que la renovación hereda del paquete anterior. */
export type PaqueteRenovable = {
  id: string;
  sedeId: string;
  pacienteId: string;
  /** Evaluación abierta del paciente: la que aplica la renovación. */
  evaluacionId: string;
  evaluacionFecha: Date;
  /** Fecha de la evaluación del paquete anterior si es otra (fue reemplazada). */
  evaluacionAnteriorFecha: Date | null;
  precio: number;
  observacion: string | null;
  /** Terapeuta y horario semanal de cada terapia del paquete anterior. */
  sugerencias: { terapiaId: string; terapeutaId: string | null; plantilla: DiaPlantilla[] }[];
};

/**
 * ¿Se puede renovar este paquete? Requiere que todas sus sesiones tengan
 * asistencia registrada y que el paciente tenga una evaluación abierta: la
 * renovación aplica esa, sea la misma del paquete o una más nueva que la
 * reemplazó. Sin evaluación abierta, los paquetes antiguos (sin evaluación) se
 * renuevan con `renovarPaquete`.
 */
export async function paqueteRenovable(
  paqueteId: string,
): Promise<{ error: string } | { paquete: PaqueteRenovable }> {
  const p = await prisma.paquete.findUnique({
    where: { id: paqueteId },
    select: {
      id: true,
      sedeId: true,
      pacienteId: true,
      precio: true,
      observacion: true,
      evaluacion: { select: { id: true, fecha: true } },
      terapias: {
        orderBy: { orden: "asc" },
        select: {
          terapiaId: true,
          terapeutaId: true,
          citas: {
            where: { tipo: "SESION" },
            orderBy: { numeroSesion: "asc" },
            select: { fecha: true, horaInicio: true },
          },
        },
      },
    },
  });
  if (!p) return { error: "Paquete no encontrado." };
  const abierta = await evaluacionAbierta(p.pacienteId);
  if (!abierta) {
    return {
      error:
        "El paciente no tiene una evaluación abierta. Registra una nueva evaluación para renovar.",
    };
  }
  const pendientes = await prisma.cita.count({
    where: { paqueteId, tipo: "SESION", asistencia: "PENDIENTE" },
  });
  if (pendientes > 0) {
    return {
      error: `No puedes renovar: aún hay ${pendientes} sesión(es) sin asistencia registrada en este paquete.`,
    };
  }

  return {
    paquete: {
      id: p.id,
      sedeId: p.sedeId,
      pacienteId: p.pacienteId,
      evaluacionId: abierta.id,
      evaluacionFecha: abierta.fecha,
      evaluacionAnteriorFecha:
        p.evaluacion && p.evaluacion.id !== abierta.id ? p.evaluacion.fecha : null,
      precio: Number(p.precio),
      observacion: p.observacion,
      sugerencias: p.terapias
        .filter((t) => t.terapiaId)
        .map((t) => ({
          terapiaId: t.terapiaId!,
          terapeutaId: t.terapeutaId,
          plantilla: plantillaSemanal(t.citas),
        })),
    },
  };
}

/** La evaluación abierta del paciente (solo puede haber una), o null. */
export function evaluacionAbierta(pacienteId: string) {
  return prisma.evaluacion.findFirst({
    where: { pacienteId, cerradaEn: null },
    orderBy: { fecha: "desc" },
    select: { id: true, fecha: true },
  });
}
