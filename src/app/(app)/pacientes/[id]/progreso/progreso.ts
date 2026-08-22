// Analítica de progreso del paciente. SIN "use server": se importa desde la
// página (server component) y desde los tests.
//
// El único instrumento comparable en el tiempo es el Informe de Avance: los
// mismos ítems, en la misma escala ordinal EI/EP/LE, aplicados en fechas
// distintas. La Ficha de Evaluación queda fuera a propósito —usa otro catálogo
// y otras escalas (I/P/L y SI/NO)—: encadenar ambos instrumentos produciría una
// curva sin significado clínico.
//
// La comparación entre informes se hace SIEMPRE por `id` de ítem, nunca por su
// texto, porque el texto es editable en cada informe. Por eso el informe nuevo
// se precarga con los ítems del anterior (ver informes/nuevo/page.tsx): los
// ítems agregados a mano llevan un id propio y, sin esa precarga, cada informe
// los volvería a crear con otro id y no habría serie que comparar.

import {
  VALORES_INFORME,
  normalizarSecciones,
  type SeccionInforme,
  type ValorInforme,
} from "../informes/informe";

/**
 * EI/EP/LE es una escala ordinal de tres niveles; se puntúa 0-1-2 para poder
 * resumirla en un porcentaje de logro. Es una ayuda de lectura, no una medida
 * psicométrica: la califica un profesional y los tramos no son necesariamente
 * equidistantes. Sirve para comparar al paciente consigo mismo; no para
 * compararlo con otros pacientes.
 */
export const PUNTAJE: Record<ValorInforme, number> = { EI: 0, EP: 1, LE: 2 };

const PUNTAJE_MAXIMO = PUNTAJE.LE;

/** Cuántos informes entran en los gráficos (se toman los más recientes). */
export const MAX_PUNTOS = 8;

export type Conteo = Record<ValorInforme, number>;

export type ResumenArea = {
  id: string;
  titulo: string;
  /** Ítems con calificación / ítems de la sección. */
  calificados: number;
  total: number;
  conteo: Conteo;
  /** Logro 0–100 sobre los ítems calificados; null si no hay ninguno. */
  logro: number | null;
};

/** Un informe resumido: el punto de la serie. */
export type PuntoProgreso = {
  informeId: string;
  fecha: Date;
  areas: ResumenArea[];
  general: ResumenArea;
};

/** Lo que la página necesita leer de cada informe para armar la serie. */
export type InformeFuente = {
  id: string;
  fecha: Date;
  /** Json crudo de InformeAvance.secciones. */
  secciones: unknown;
};

function conteoVacio(): Conteo {
  return { EI: 0, EP: 0, LE: 0 };
}

function calificados(conteo: Conteo): number {
  return VALORES_INFORME.reduce((n, v) => n + conteo[v], 0);
}

/**
 * Porcentaje de logro de un conteo: puntaje obtenido sobre el máximo posible,
 * contando solo los ítems calificados. Los ítems sin calificar no se cuentan
 * como cero —no evaluado no es lo mismo que en inicio—; por eso cada resumen
 * lleva además `calificados` / `total`, para que se vea sobre cuánto se calculó.
 */
export function logroDe(conteo: Conteo): number | null {
  const n = calificados(conteo);
  if (n === 0) return null;
  const puntaje = VALORES_INFORME.reduce((s, v) => s + conteo[v] * PUNTAJE[v], 0);
  return Math.round((puntaje / (n * PUNTAJE_MAXIMO)) * 100);
}

/** Resume un informe por área, más el consolidado de todas ellas. */
export function resumirInforme(secciones: SeccionInforme[]): {
  areas: ResumenArea[];
  general: ResumenArea;
} {
  const totalConteo = conteoVacio();
  let totalItems = 0;

  const areas = secciones.map((s) => {
    const conteo = conteoVacio();
    for (const item of s.items) {
      totalItems++;
      if (item.valor) {
        conteo[item.valor]++;
        totalConteo[item.valor]++;
      }
    }
    return {
      id: s.id,
      titulo: s.titulo,
      calificados: calificados(conteo),
      total: s.items.length,
      conteo,
      logro: logroDe(conteo),
    };
  });

  return {
    areas,
    general: {
      id: "general",
      titulo: "General",
      calificados: calificados(totalConteo),
      total: totalItems,
      conteo: totalConteo,
      logro: logroDe(totalConteo),
    },
  };
}

/**
 * Serie de progreso, del informe más antiguo al más reciente. Si hay más de
 * MAX_PUNTOS informes se conservan los últimos: la lectura clínica es sobre el
 * tramo reciente y una curva con decenas de puntos deja de leerse.
 */
export function serieProgreso(informes: InformeFuente[]): PuntoProgreso[] {
  const ordenados = [...informes].sort(
    (a, b) => a.fecha.getTime() - b.fecha.getTime(),
  );

  return ordenados.slice(-MAX_PUNTOS).map((inf) => {
    const { areas, general } = resumirInforme(normalizarSecciones(inf.secciones));
    return { informeId: inf.id, fecha: inf.fecha, areas, general };
  });
}

export type EstadoCambio =
  | "mejora"
  | "igual"
  | "retroceso"
  /** Ítem que no existía en el informe anterior. */
  | "nuevo"
  /** Ítem del informe anterior que ya no está en el actual. */
  | "retirado"
  /** El ítem está en ambos, pero a alguno le falta la calificación. */
  | "sin_dato";

export type CambioItem = {
  id: string;
  label: string;
  anterior: ValorInforme | null;
  actual: ValorInforme | null;
  estado: EstadoCambio;
};

export type CambioArea = {
  id: string;
  titulo: string;
  items: CambioItem[];
  mejoras: number;
  iguales: number;
  retrocesos: number;
};

function estadoDe(
  anterior: ValorInforme | null,
  actual: ValorInforme | null,
): EstadoCambio {
  if (!anterior || !actual) return "sin_dato";
  const delta = PUNTAJE[actual] - PUNTAJE[anterior];
  if (delta > 0) return "mejora";
  if (delta < 0) return "retroceso";
  return "igual";
}

/**
 * Compara dos informes ítem a ítem. El orden y los textos los manda el informe
 * `actual`; los ítems que solo estaban en el anterior se listan al final como
 * "retirado" para que no desaparezcan sin dejar rastro.
 */
export function compararInformes(
  anterior: SeccionInforme[],
  actual: SeccionInforme[],
): CambioArea[] {
  const areasAnteriores = new Map(anterior.map((s) => [s.id, s]));

  return actual.map((seccion) => {
    const previa = areasAnteriores.get(seccion.id);
    const itemsPrevios = new Map(
      (previa?.items ?? []).map((i) => [i.id, i.valor ?? null]),
    );

    const items: CambioItem[] = seccion.items.map((item) => {
      const existiaAntes = itemsPrevios.has(item.id);
      const valorAnterior = itemsPrevios.get(item.id) ?? null;
      const valorActual = item.valor ?? null;
      itemsPrevios.delete(item.id);
      return {
        id: item.id,
        label: item.label,
        anterior: valorAnterior,
        actual: valorActual,
        estado: existiaAntes ? estadoDe(valorAnterior, valorActual) : "nuevo",
      };
    });

    // Lo que quedó en el mapa estaba en el informe anterior y ya no está.
    for (const [id, valor] of itemsPrevios) {
      const item = previa?.items.find((i) => i.id === id);
      items.push({
        id,
        label: item?.label ?? id,
        anterior: valor,
        actual: null,
        estado: "retirado",
      });
    }

    return {
      id: seccion.id,
      titulo: seccion.titulo,
      items,
      mejoras: items.filter((i) => i.estado === "mejora").length,
      iguales: items.filter((i) => i.estado === "igual").length,
      retrocesos: items.filter((i) => i.estado === "retroceso").length,
    };
  });
}
