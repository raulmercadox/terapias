import { prisma } from "@/lib/prisma";
import type { TerapiaOpcion } from "./tratamiento-editor";

/**
 * Terapias que se pueden sugerir en el tratamiento: las activas de la sede y,
 * al editar, también las que ya tenga la evaluación aunque se hayan desactivado.
 */
export async function opcionesTerapia(
  sedeId: string,
  incluirIds: string[] = [],
): Promise<TerapiaOpcion[]> {
  const terapias = await prisma.terapia.findMany({
    where: {
      sedeId,
      OR: [{ activo: true }, { id: { in: incluirIds } }],
    },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      modalidad: true,
      maxParticipantes: true,
      especialidad: { select: { nombre: true } },
    },
  });
  return terapias.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    especialidad: t.especialidad?.nombre ?? null,
    modalidad: t.modalidad,
    maxParticipantes: t.maxParticipantes,
  }));
}
