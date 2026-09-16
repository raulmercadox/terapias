// Saneado y consultas sobre una plantilla de ficha. Módulo puro.
//
// `normalizarPlantilla` es la misma filosofía que `normalizarSecciones` del
// informe de avance: el JSON viene de la base o del editor y pudo escribirse
// con otra versión del esquema, así que NO se confía en el tipo — se descarta
// lo que no cumpla la forma en vez de romper la pantalla.

import {
  type Campo,
  type Escala,
  type Grupo,
  type Plantilla,
  type Seccion,
  type ValoresFicha,
} from "./tipos";

/* ── Saneado ──────────────────────────────────────────── */

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object" && !Array.isArray(v);

/** Texto recortado; null si no es string o queda vacío. */
function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function opciones(v: unknown): { valor: string; label: string }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((o) => {
    if (!esObjeto(o)) return [];
    const valor = texto(o.valor);
    if (!valor) return [];
    return [{ valor, label: texto(o.label) ?? valor }];
  });
}

function escala(v: unknown): Escala | null {
  if (!esObjeto(v)) return null;
  const id = texto(v.id);
  if (!id) return null;
  const valores = Array.isArray(v.valores)
    ? v.valores.flatMap((x) => {
        const s = texto(x);
        return s ? [s] : [];
      })
    : [];
  if (valores.length === 0) return null;
  const labels: Record<string, string> = {};
  if (esObjeto(v.labels)) {
    for (const valor of valores) {
      labels[valor] = texto(v.labels[valor]) ?? valor;
    }
  } else {
    for (const valor of valores) labels[valor] = valor;
  }
  return { id, valores, labels };
}

function campo(v: unknown): Campo | null {
  if (!esObjeto(v)) return null;
  const id = texto(v.id);
  const tipo = texto(v.tipo);
  if (!id || !tipo) return null;
  const label = texto(v.label);
  const ayuda = texto(v.ayuda) ?? undefined;

  switch (tipo) {
    case "texto":
      if (!label) return null;
      return {
        tipo: "texto",
        id,
        label,
        ayuda,
        ancho: v.ancho === "completo" ? "completo" : undefined,
      };
    case "parrafo": {
      if (!label) return null;
      const filas = typeof v.filas === "number" && v.filas > 0 ? v.filas : undefined;
      return { tipo: "parrafo", id, label, ayuda, filas };
    }
    case "casilla":
      return label ? { tipo: "casilla", id, label } : null;
    case "opciones": {
      if (!label) return null;
      const ops = opciones(v.opciones);
      if (ops.length === 0) return null;
      return { tipo: "opciones", id, label, multiple: v.multiple === true, opciones: ops, ayuda };
    }
    case "tabla": {
      if (!label) return null;
      const columnas = Array.isArray(v.columnas)
        ? v.columnas.flatMap((c) => {
            if (!esObjeto(c)) return [];
            const cid = texto(c.id);
            if (!cid) return [];
            return [
              {
                id: cid,
                label: texto(c.label) ?? cid,
                ancho: c.ancho === "corto" ? ("corto" as const) : undefined,
              },
            ];
          })
        : [];
      if (columnas.length === 0) return null;
      const filasSugeridas = Array.isArray(v.filasSugeridas)
        ? v.filasSugeridas.flatMap((f) => {
            if (!esObjeto(f)) return [];
            const fila: Record<string, string> = {};
            for (const col of columnas) {
              const val = texto(f[col.id]);
              if (val) fila[col.id] = val;
            }
            return Object.keys(fila).length > 0 ? [fila] : [];
          })
        : undefined;
      return { tipo: "tabla", id, label, columnas, filasSugeridas };
    }
    case "checklist": {
      const items = Array.isArray(v.items)
        ? v.items.flatMap((i) => {
            if (!esObjeto(i)) return [];
            const iid = texto(i.id);
            const ilabel = texto(i.label);
            if (!iid || !ilabel) return [];
            return [{ id: iid, label: ilabel }];
          })
        : [];
      if (items.length === 0) return null;
      return {
        tipo: "checklist",
        id,
        label: label ?? null,
        escalaId: texto(v.escalaId) ?? undefined,
        conObservacion: typeof v.conObservacion === "boolean" ? v.conObservacion : undefined,
        items,
      };
    }
    default:
      return null;
  }
}

function grupo(v: unknown): Grupo | null {
  if (!esObjeto(v)) return null;
  const id = texto(v.id);
  if (!id) return null;
  const campos = Array.isArray(v.campos)
    ? v.campos.flatMap((c) => {
        const parsed = campo(c);
        return parsed ? [parsed] : [];
      })
    : [];
  if (campos.length === 0) return null;

  let visibleSi: Grupo["visibleSi"];
  if (esObjeto(v.visibleSi)) {
    const campoId = texto(v.visibleSi.campoId);
    const valores = Array.isArray(v.visibleSi.valores)
      ? v.visibleSi.valores.flatMap((x) => {
          const s = texto(x);
          return s ? [s] : [];
        })
      : [];
    if (campoId && valores.length > 0) visibleSi = { campoId, valores };
  }

  return { id, titulo: texto(v.titulo), visibleSi, campos };
}

function seccion(v: unknown): Seccion | null {
  if (!esObjeto(v)) return null;
  const id = texto(v.id);
  const titulo = texto(v.titulo);
  if (!id || !titulo) return null;
  const grupos = Array.isArray(v.grupos)
    ? v.grupos.flatMap((g) => {
        const parsed = grupo(g);
        return parsed ? [parsed] : [];
      })
    : [];
  if (grupos.length === 0) return null;
  return {
    id,
    titulo,
    descripcion: texto(v.descripcion),
    escalaId: texto(v.escalaId),
    conObservacion: v.conObservacion === true,
    numerarGrupos: v.numerarGrupos === true,
    itemsAbiertos: v.itemsAbiertos === true,
    grupos,
  };
}

export function plantillaVacia(): Plantilla {
  return { formato: 1, escalas: [], secciones: [], numerarSecciones: true };
}

/** Sanea el JSON de una plantilla. Nunca lanza: lo inválido se descarta. */
export function normalizarPlantilla(input: unknown): Plantilla {
  if (!esObjeto(input)) return plantillaVacia();
  const escalas = Array.isArray(input.escalas)
    ? input.escalas.flatMap((e) => {
        const parsed = escala(e);
        return parsed ? [parsed] : [];
      })
    : [];
  const secciones = Array.isArray(input.secciones)
    ? input.secciones.flatMap((s) => {
        const parsed = seccion(s);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    formato: 1,
    escalas,
    secciones,
    numerarSecciones: input.numerarSecciones !== false,
    muestraProgramaRecomendado: input.muestraProgramaRecomendado === true,
  };
}

/* ── Consultas ────────────────────────────────────────── */

/** Todos los campos de la plantilla, en orden de aparición. */
export function camposDe(plantilla: Plantilla): Campo[] {
  return plantilla.secciones.flatMap((s) => s.grupos.flatMap((g) => g.campos));
}

export function campoPorId(plantilla: Plantilla, id: string): Campo | undefined {
  return camposDe(plantilla).find((c) => c.id === id);
}

/**
 * Ids de campo repetidos. Los valores se guardan en un mapa plano por id, así
 * que un id duplicado haría que dos campos compartan el mismo valor; el editor
 * se niega a guardar si esto devuelve algo.
 */
export function idsDuplicados(plantilla: Plantilla): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const c of camposDe(plantilla)) {
    if (vistos.has(c.id)) repetidos.add(c.id);
    vistos.add(c.id);
    if (c.tipo === "checklist") {
      for (const it of c.items) {
        if (vistos.has(it.id)) repetidos.add(it.id);
        vistos.add(it.id);
      }
    }
  }
  return [...repetidos];
}

/**
 * ¿El grupo se muestra con estos valores? Sin condición, siempre. Con condición
 * pero sin valor elegido todavía, también: reproduce el comportamiento del
 * `grupoAplica` que reemplaza, donde una modalidad sin elegir dejaba ver todos
 * los grupos para poder llenar cualquiera de ellos.
 */
export function grupoVisible(grupo: Grupo, valores: ValoresFicha): boolean {
  const cond = grupo.visibleSi;
  if (!cond) return true;
  const actual = valores[cond.campoId];
  if (!actual) return true;
  const elegidos =
    actual.t === "opciones" ? actual.v : actual.t === "texto" ? [actual.v] : [];
  if (elegidos.length === 0 || elegidos.every((e) => e === "")) return true;
  return elegidos.some((e) => cond.valores.includes(e));
}

/** Escala de un checklist: la suya, o la de su sección. Null si no se resuelve. */
export function escalaDe(
  plantilla: Plantilla,
  seccion: Seccion,
  campo: Campo,
): Escala | null {
  if (campo.tipo !== "checklist") return null;
  const id = campo.escalaId ?? seccion.escalaId ?? null;
  if (!id) return null;
  return plantilla.escalas.find((e) => e.id === id) ?? null;
}

/** Si un checklist lleva columna de observación (la suya o la de su sección). */
export function conObservacion(seccion: Seccion, campo: Campo): boolean {
  if (campo.tipo !== "checklist") return false;
  return campo.conObservacion ?? seccion.conObservacion ?? false;
}
