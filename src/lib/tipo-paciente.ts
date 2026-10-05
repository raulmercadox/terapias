import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Un registrado es PACIENTE cuando ya está en terapia: tiene un paquete
// agendado (no anulado) o asistió a una sesión suelta (sin paquete). El resto
// son POTENCIALES (evaluados o interesados que aún no empiezan). Se calcula
// a partir de los datos, no se guarda: anular el paquete lo devuelve a potencial.
//
// Combínalos siempre dentro de `AND: [...]`: otros filtros ya usan las claves
// `OR` y `citas` y un spread las pisaría.

export const WHERE_ES_PACIENTE: Prisma.PacienteWhereInput = {
  OR: [
    { paquetes: { some: { estado: { not: "ANULADO" } } } },
    {
      citas: {
        some: {
          paqueteId: null,
          tipo: "SESION",
          estado: { not: "CANCELADA" },
          asistencia: { in: ["ASISTIO", "TARDANZA"] },
        },
      },
    },
  ],
};

export const WHERE_ES_POTENCIAL: Prisma.PacienteWhereInput = {
  NOT: WHERE_ES_PACIENTE,
};

export type TipoPaciente = "pacientes" | "potenciales";

/** ¿Ya es paciente (en terapia) o todavía es potencial? */
export async function esPaciente(pacienteId: string): Promise<boolean> {
  const n = await prisma.paciente.count({
    where: { id: pacienteId, AND: [WHERE_ES_PACIENTE] },
  });
  return n > 0;
}
