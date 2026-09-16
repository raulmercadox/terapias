// Catálogo de plantillas prearmadas por rubro.
//
// Módulo PURO a propósito (sin "server-only"): el formulario de alta de centros
// es un componente cliente y necesita las etiquetas de cada rubro. La lectura de
// la plantilla vigente de un centro, que sí toca la base de datos, vive aparte
// en src/lib/plantillas.ts.

import type { Prisma } from "@prisma/client";
import { TIPOS_FICHA, type Plantilla, type TipoFicha } from "../tipos";
import { PSICOLOGICA } from "./psicologica";
import { FISICA } from "./fisica";

export const BASES = {
  psicologica: {
    label: "Psicológica / lenguaje",
    descripcion:
      "Historia clínica con antecedentes del desarrollo, evaluación por áreas (conductual, lenguaje, cognitiva, sensorial) e informe de avance.",
    plantillas: PSICOLOGICA,
  },
  fisica: {
    label: "Física / rehabilitación",
    descripcion:
      "Anamnesis y motivo de consulta, dolor (EVA), rangos articulares, fuerza (Daniels), marcha y funcionalidad.",
    plantillas: FISICA,
  },
} as const;

export type BaseId = keyof typeof BASES;

export const BASE_POR_DEFECTO: BaseId = "psicologica";

export function esBaseValida(v: unknown): v is BaseId {
  return typeof v === "string" && v in BASES;
}

/** La plantilla prearmada de un rubro, sin tocar la base de datos. */
export function plantillaBase(base: BaseId, tipo: TipoFicha): Plantilla {
  return BASES[base].plantillas[tipo];
}

/**
 * Las tres filas de plantilla de un rubro, listas para el `create` anidado que
 * da de alta un centro (o para sembrarlas después).
 */
export function filasDePlantillas(base: BaseId) {
  return TIPOS_FICHA.map((tipo) => ({
    tipo,
    base,
    version: 1,
    secciones: plantillaBase(base, tipo) as unknown as Prisma.InputJsonValue,
  }));
}
