// Tratamiento sugerido en la evaluación: terapias con sus sesiones en un plazo
// (normalmente 4 semanas). Reglas puras, compartidas por el form y la acción.

export const PLAZO_SEMANAS_DEFECTO = 4;
export const MAX_SESIONES_TERAPIA = 60;
export const MAX_PLAZO_SEMANAS = 26;

export type LineaTratamiento = {
  terapiaId: string;
  sesiones: number;
  sesionesSemana: number;
};

/** Sesiones por semana sugeridas para repartir `sesiones` en `plazoSemanas`. */
export function sesionesSemanaSugeridas(sesiones: number, plazoSemanas: number): number {
  if (!(sesiones > 0) || !(plazoSemanas > 0)) return 1;
  return Math.max(1, Math.ceil(sesiones / plazoSemanas));
}

const entero = (v: unknown): number =>
  typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;

/**
 * Lee el tratamiento enviado por el formulario (`plazoSemanas` y un JSON con
 * las líneas). Un tratamiento vacío es válido (la evaluación puede no sugerir
 * terapias). Devuelve un mensaje de error si algo no cuadra.
 */
export function parseTratamiento(
  plazoRaw: unknown,
  lineasRaw: unknown,
): { plazoSemanas: number; lineas: LineaTratamiento[] } | { error: string } {
  const plazoSemanas =
    plazoRaw == null || plazoRaw === "" ? PLAZO_SEMANAS_DEFECTO : entero(plazoRaw);
  if (!Number.isInteger(plazoSemanas) || plazoSemanas < 1 || plazoSemanas > MAX_PLAZO_SEMANAS) {
    return { error: `El plazo del tratamiento debe ser de 1 a ${MAX_PLAZO_SEMANAS} semanas.` };
  }

  let crudas: unknown = [];
  if (typeof lineasRaw === "string" && lineasRaw.trim() !== "") {
    try {
      crudas = JSON.parse(lineasRaw);
    } catch {
      return { error: "No se pudo leer el tratamiento sugerido." };
    }
  }
  if (!Array.isArray(crudas)) return { error: "No se pudo leer el tratamiento sugerido." };

  const lineas: LineaTratamiento[] = [];
  const vistas = new Set<string>();
  for (const c of crudas) {
    const o = (c ?? {}) as Record<string, unknown>;
    const terapiaId = typeof o.terapiaId === "string" ? o.terapiaId : "";
    if (!terapiaId) return { error: "Seleccione la terapia en cada fila del tratamiento." };
    if (vistas.has(terapiaId)) {
      return { error: "Una terapia aparece dos veces en el tratamiento." };
    }
    vistas.add(terapiaId);

    const sesiones = entero(o.sesiones);
    if (!Number.isInteger(sesiones) || sesiones < 1 || sesiones > MAX_SESIONES_TERAPIA) {
      return { error: `Las sesiones de cada terapia deben ser de 1 a ${MAX_SESIONES_TERAPIA}.` };
    }
    const sesionesSemana = entero(o.sesionesSemana);
    if (!Number.isInteger(sesionesSemana) || sesionesSemana < 1 || sesionesSemana > 7) {
      return { error: "Las sesiones por semana deben ser de 1 a 7." };
    }
    if (sesionesSemana > sesiones) {
      return { error: "Las sesiones por semana no pueden superar al total de sesiones." };
    }
    lineas.push({ terapiaId, sesiones, sesionesSemana });
  }
  return { plazoSemanas, lineas };
}
