import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { normalizarPlantilla } from "@/lib/fichas/plantilla";
import { PSICOLOGICA } from "@/lib/fichas/base/psicologica";
import { BASE_POR_DEFECTO } from "@/lib/fichas/base";
import type { Plantilla, TipoFicha } from "@/lib/fichas/tipos";

export type PlantillaVigente = {
  plantilla: Plantilla;
  /** 0 = el centro no tiene fila propia y rige la base psicológica. */
  version: number;
  base: string;
};

/**
 * Plantilla vigente de un centro para un tipo de ficha. Memoizada por request,
 * igual que `obtenerConfiguracion` (src/lib/configuracion.ts): la piden el
 * formulario, la vista y la impresión dentro de la misma pantalla.
 *
 * Sin fila se devuelve la base psicológica, que es la estructura con la que
 * nació el sistema: así un centro anterior a las plantillas sigue funcionando.
 */
export const obtenerPlantilla = cache(
  async (centroId: string, tipo: TipoFicha): Promise<PlantillaVigente> => {
    const fila = await prisma.plantillaFicha.findUnique({
      where: { centroId_tipo: { centroId, tipo } },
    });
    if (!fila) {
      return { plantilla: PSICOLOGICA[tipo], version: 0, base: BASE_POR_DEFECTO };
    }
    return {
      plantilla: normalizarPlantilla(fila.secciones),
      version: fila.version,
      base: fila.base,
    };
  },
);
