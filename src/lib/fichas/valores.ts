// Saneado de los valores registrados en una ficha, contra su plantilla.
//
// Regla de oro: los valores de campos que ya no están en la plantilla NO se
// borran. Si el administrador quita un campo, lo registrado en las fichas
// antiguas se conserva y la vista lo muestra aparte (ver `huerfanos`). Es la
// misma política con la que el informe de avance conserva al final las
// secciones retiradas del catálogo.

import { camposDe, conObservacion, escalaDe, grupoVisible } from "./plantilla";
import type { Campo, Plantilla, ValorCampo, ValoresFicha } from "./tipos";

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object" && !Array.isArray(v);

const recorta = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * ¿El valor viene ya etiquetado (como se guarda) o crudo (como llega del
 * formulario)? Hay que distinguirlo explícitamente: un checklist crudo
 * —`{ item1: { valor: "L" } }`— también es un objeto, así que buscar `.items`
 * en todo objeto vaciaba el campo al leerlo del formulario.
 */
function etiquetado<T extends ValorCampo["t"]>(
  v: unknown,
  t: T,
): v is Extract<ValorCampo, { t: T }> {
  return esObjeto(v) && v.t === t;
}

/** Sanea un valor suelto según el tipo declarado en él mismo (`t`). */
function valorHuerfano(v: unknown): ValorCampo | null {
  if (!esObjeto(v)) return null;
  switch (v.t) {
    case "texto":
      return typeof v.v === "string" ? { t: "texto", v: v.v } : null;
    case "casilla":
      return typeof v.v === "boolean" ? { t: "casilla", v: v.v } : null;
    case "opciones":
      return Array.isArray(v.v)
        ? { t: "opciones", v: v.v.filter((x): x is string => typeof x === "string") }
        : null;
    case "tabla":
      return Array.isArray(v.filas)
        ? {
            t: "tabla",
            filas: v.filas.flatMap((f) => {
              if (!esObjeto(f)) return [];
              const fila: Record<string, string> = {};
              for (const [k, val] of Object.entries(f)) {
                const s = recorta(val);
                if (s) fila[k] = s;
              }
              return Object.keys(fila).length > 0 ? [fila] : [];
            }),
          }
        : null;
    case "checklist": {
      if (!esObjeto(v.items)) return null;
      const items: Record<string, { valor?: string; obs?: string }> = {};
      for (const [id, raw] of Object.entries(v.items)) {
        if (!esObjeto(raw)) continue;
        const entrada: { valor?: string; obs?: string } = {};
        const valor = recorta(raw.valor);
        const obs = recorta(raw.obs);
        if (valor) entrada.valor = valor;
        if (obs) entrada.obs = obs;
        if (entrada.valor || entrada.obs) items[id] = entrada;
      }
      return { t: "checklist", items };
    }
    default:
      return null;
  }
}

/** Sanea el valor de un campo concreto, validándolo contra su definición. */
function valorDeCampo(
  plantilla: Plantilla,
  seccionIdx: number,
  campo: Campo,
  bruto: unknown,
): ValorCampo | null {
  const seccion = plantilla.secciones[seccionIdx];
  switch (campo.tipo) {
    case "texto":
    case "parrafo": {
      const v = etiquetado(bruto, "texto") ? recorta(bruto.v) : recorta(bruto);
      return v ? { t: "texto", v } : null;
    }
    case "casilla": {
      const v = etiquetado(bruto, "casilla") ? bruto.v === true : bruto === true;
      return v ? { t: "casilla", v: true } : null;
    }
    case "opciones": {
      const crudo = etiquetado(bruto, "opciones") ? bruto.v : bruto;
      const lista = Array.isArray(crudo) ? crudo : [crudo];
      const validos = campo.opciones.map((o) => o.valor);
      const v = lista
        .map(recorta)
        .filter((x) => x !== "" && validos.includes(x))
        .slice(0, campo.multiple ? undefined : 1);
      return v.length > 0 ? { t: "opciones", v } : null;
    }
    case "tabla": {
      const crudo = etiquetado(bruto, "tabla") ? bruto.filas : bruto;
      if (!Array.isArray(crudo)) return null;
      const columnas = campo.columnas.map((c) => c.id);
      const filas = crudo.flatMap((f) => {
        if (!esObjeto(f)) return [];
        const fila: Record<string, string> = {};
        for (const col of columnas) {
          const s = recorta(f[col]);
          if (s) fila[col] = s;
        }
        // Una fila enteramente vacía no se guarda (igual que la vieja
        // `normalizarFamiliares` de la historia clínica).
        return Object.keys(fila).length > 0 ? [fila] : [];
      });
      return filas.length > 0 ? { t: "tabla", filas } : null;
    }
    case "checklist": {
      const crudo = etiquetado(bruto, "checklist") ? bruto.items : bruto;
      if (!esObjeto(crudo)) return null;
      const escala = escalaDe(plantilla, seccion, campo);
      const dominio = escala?.valores ?? [];
      const admiteObs = conObservacion(seccion, campo);
      const idsValidos = new Set(campo.items.map((i) => i.id));
      const items: Record<string, { valor?: string; obs?: string }> = {};
      for (const [id, raw] of Object.entries(crudo)) {
        if (!idsValidos.has(id) || !esObjeto(raw)) continue;
        const entrada: { valor?: string; obs?: string } = {};
        const valor = recorta(raw.valor);
        if (valor && dominio.includes(valor)) entrada.valor = valor;
        if (admiteObs) {
          const obs = recorta(raw.obs);
          if (obs) entrada.obs = obs;
        }
        if (entrada.valor || entrada.obs) items[id] = entrada;
      }
      return Object.keys(items).length > 0 ? { t: "checklist", items } : null;
    }
  }
}

/**
 * Sanea los valores de una ficha contra su plantilla. Descarta lo que no cumple
 * la forma o el dominio, omite los grupos que la condición `visibleSi` deja
 * fuera —no se registra lo que no se evaluó— y conserva los valores huérfanos.
 */
export function normalizarValores(input: unknown, plantilla: Plantilla): ValoresFicha {
  if (!esObjeto(input)) return {};
  const out: ValoresFicha = {};

  // Primera pasada: campos que no dependen de una condición, para poder
  // resolver `visibleSi` con valores ya saneados (ej. la modalidad elegida).
  for (const pasada of [1, 2] as const) {
    plantilla.secciones.forEach((seccion, si) => {
      for (const grupo of seccion.grupos) {
        const condicional = Boolean(grupo.visibleSi);
        if (pasada === 1 ? condicional : !condicional) continue;
        if (pasada === 2 && !grupoVisible(grupo, out)) continue;
        for (const campo of grupo.campos) {
          const valor = valorDeCampo(plantilla, si, campo, input[campo.id]);
          if (valor) out[campo.id] = valor;
        }
      }
    });
  }

  // Huérfanos: lo registrado con una versión anterior de la plantilla.
  const conocidos = new Set(camposDe(plantilla).map((c) => c.id));
  for (const [id, bruto] of Object.entries(input)) {
    if (conocidos.has(id) || out[id]) continue;
    const valor = valorHuerfano(bruto);
    if (valor) out[id] = valor;
  }

  return out;
}

/** Valores que ya no corresponden a ningún campo de la plantilla vigente. */
export function huerfanos(
  valores: ValoresFicha,
  plantilla: Plantilla,
): [string, ValorCampo][] {
  const conocidos = new Set(camposDe(plantilla).map((c) => c.id));
  return Object.entries(valores).filter(([id]) => !conocidos.has(id));
}

/** ¿La ficha tiene algo registrado? Para el estado vacío de las vistas. */
export function tieneDatos(valores: ValoresFicha): boolean {
  return Object.keys(valores).length > 0;
}
