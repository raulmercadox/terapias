import "server-only";
import { cache } from "react";
import type { Configuracion } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Valores por defecto mientras el centro no haya guardado su configuración. */
const POR_DEFECTO = {
  graciaTipo: "PORCENTAJE",
  graciaValor: 50,
  diasAvisoCobro: 7,
} as const satisfies Omit<Configuracion, "centroId" | "updatedAt">;

export type ConfiguracionCentro = Omit<Configuracion, "updatedAt">;

/**
 * Configuración de cobranza del centro (una fila por centro; sin fila, los
 * valores por defecto). Memoizada por request: la piden Inicio, /pagos,
 * Cobranza y el detalle del paquete dentro de la misma pantalla.
 */
export const obtenerConfiguracion = cache(
  async (centroId: string): Promise<ConfiguracionCentro> => {
    const c = await prisma.configuracion.findUnique({ where: { centroId } });
    return c ?? { centroId, ...POR_DEFECTO };
  },
);
