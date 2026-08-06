// Catálogo y saneadores de la Historia Clínica. Módulo puro (sin "use server")
// para poder usarlo en formularios cliente, vistas servidor y pruebas.

/** Fila de la tabla "2.1 Historia Familiar". */
export type Familiar = {
  parentesco?: string;
  nombres?: string;
  edad?: string;
  ocupacion?: string;
  relacion?: string;
};

const CAMPOS_FAMILIAR = [
  "parentesco",
  "nombres",
  "edad",
  "ocupacion",
  "relacion",
] as const;

/**
 * Sanea la tabla de familiares leída del Json de la BD o armada desde el
 * formulario: solo objetos dentro de un array, solo los campos conocidos,
 * strings recortados; descarta filas completamente vacías.
 */
export function normalizarFamiliares(input: unknown): Familiar[] {
  if (!Array.isArray(input)) return [];
  const out: Familiar[] = [];
  for (const raw of input) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const fila: Familiar = {};
    for (const campo of CAMPOS_FAMILIAR) {
      const valor = (raw as Record<string, unknown>)[campo];
      if (typeof valor === "string" && valor.trim() !== "") {
        fila[campo] = valor.trim();
      }
    }
    if (Object.keys(fila).length > 0) out.push(fila);
  }
  return out;
}

/** Checkboxes de "IV. Reacción de los padres", en el orden del formato impreso. */
export const REACCIONES_PADRES = [
  { id: "reaccionRechazo", label: "Rechazo" },
  { id: "reaccionIndiferencia", label: "Indiferencia" },
  { id: "reaccionAceptacion", label: "Aceptación" },
  { id: "reaccionPreocupacion", label: "Preocupación" },
  { id: "reaccionVerguenza", label: "Vergüenza" },
] as const;

export type ReaccionId = (typeof REACCIONES_PADRES)[number]["id"];
