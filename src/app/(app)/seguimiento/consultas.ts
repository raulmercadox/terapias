import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Pacientes de la sede con al menos una ENTRADA sin atender: no existe una
// SALIDA que no sea SIN_RESPUESTA en la misma fecha o después. Es la regla de
// `pendienteDe` (seguimiento.ts) llevada a SQL para ordenar y paginar en la
// base; si cambias una, cambia la otra.
function pendientes(sedeId: string) {
  return Prisma.sql`
    SELECT e."pacienteId", MIN(e."fecha") AS "desde"
    FROM "Interaccion" e
    WHERE e."sedeId" = ${sedeId}
      AND e."direccion" = 'ENTRADA'
      AND NOT EXISTS (
        SELECT 1 FROM "Interaccion" s
        WHERE s."pacienteId" = e."pacienteId"
          AND s."direccion" = 'SALIDA'
          AND s."resultado" IS DISTINCT FROM 'SIN_RESPUESTA'
          AND s."fecha" >= e."fecha"
      )
    GROUP BY e."pacienteId"`;
}

export async function contarPendientes(sedeId: string): Promise<number> {
  const [fila] = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*)::int AS "total" FROM (${pendientes(sedeId)}) p`;
  return fila?.total ?? 0;
}

/** Ids de pacientes pendientes, del contacto sin atender más antiguo al más reciente. */
export async function idsPendientes(
  sedeId: string,
  skip: number,
  take: number,
): Promise<string[]> {
  const filas = await prisma.$queryRaw<{ pacienteId: string }[]>`
    SELECT p."pacienteId" FROM (${pendientes(sedeId)}) p
    ORDER BY p."desde" ASC, p."pacienteId" ASC
    LIMIT ${take} OFFSET ${skip}`;
  return filas.map((f) => f.pacienteId);
}
