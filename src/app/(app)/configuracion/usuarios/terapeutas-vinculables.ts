import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Terapeutas del centro que se pueden vincular a un usuario: los activos sin
 * usuario, más el que ya tiene el usuario en edición (aunque esté inactivo).
 */
export async function terapeutasVinculables(centroId: string, userId?: string) {
  const terapeutas = await prisma.terapeuta.findMany({
    where: {
      sede: { centroId },
      OR: [
        { activo: true, usuario: null },
        ...(userId ? [{ usuario: { id: userId } }] : []),
      ],
    },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      sede: { select: { nombre: true } },
    },
  });
  return terapeutas.map((t) => ({
    id: t.id,
    nombre: `${t.apellidos}, ${t.nombres}`,
    sede: t.sede.nombre,
  }));
}
