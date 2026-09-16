// Informe de Avance. SIN "use server": se importa desde el formulario
// (cliente), las server actions y las vistas.
//
// A diferencia de la historia clínica —que sigue la plantilla vigente del
// centro— cada informe guarda su estructura COMPLETA dentro de
// InformeAvance.secciones: secciones, ítems y el texto de cada ítem. Hay dos
// razones para que siga siendo así:
//   1. El profesional edita, agrega y quita ítems en cada informe.
//   2. La analítica de progreso compara informes por id de ítem; si la
//      estructura viniera de la plantilla vigente, editar la plantilla
//      reescribiría el pasado.
// La plantilla INFORME del centro es solo la SEMILLA del primer informe
// (ver `seccionesDePlantilla` y informes/nuevo/page.tsx).
//
// La escala es fija en los tres niveles EI/EP/LE para todos los centros: es una
// escala ordinal genérica que sirve igual a terapia psicológica y física, y es
// lo que permite que la analítica de progreso puntúe y compare. Lo que cada
// centro define son las secciones y los ítems.

import { camposDe } from "@/lib/fichas/plantilla";
import type { Plantilla } from "@/lib/fichas/tipos";

export const VALORES_INFORME = ["EI", "EP", "LE"] as const;
export type ValorInforme = (typeof VALORES_INFORME)[number];

/** Leyenda del formato impreso: "EI= En Inicio, EP= En Proceso, LE= Logro Esperado". */
export const VALOR_LABEL: Record<ValorInforme, string> = {
  EI: "En Inicio",
  EP: "En Proceso",
  LE: "Logro Esperado",
};

export type ItemInforme = {
  id: string;
  label: string;
  valor?: ValorInforme | null;
};

export type SeccionInforme = {
  id: string;
  titulo: string;
  items: ItemInforme[];
};

/**
 * Secciones iniciales de un informe nuevo, tomadas de la plantilla INFORME del
 * centro: cada checklist de la plantilla aporta sus ítems a su sección.
 */
export function seccionesDePlantilla(plantilla: Plantilla): SeccionInforme[] {
  return plantilla.secciones.flatMap((seccion) => {
    const items = seccion.grupos.flatMap((g) =>
      g.campos.flatMap((c) =>
        c.tipo === "checklist" ? c.items.map((i) => ({ id: i.id, label: i.label, valor: null })) : [],
      ),
    );
    return items.length === 0 ? [] : [{ id: seccion.id, titulo: seccion.titulo, items }];
  });
}

/** Cuántos ítems calificables tiene una plantilla de informe. */
export function totalItemsDePlantilla(plantilla: Plantilla): number {
  return camposDe(plantilla).reduce(
    (n, c) => n + (c.tipo === "checklist" ? c.items.length : 0),
    0,
  );
}

/**
 * Copia de unas secciones con las calificaciones en blanco.
 *
 * Sirve para precargar un informe nuevo con el anterior del paciente: conserva
 * los ítems que se agregaron a mano —y sobre todo sus ids, sin los cuales no
 * hay serie que comparar entre informes (ver progreso/progreso.ts)— sin
 * arrastrar los valores del informe pasado.
 */
export function seccionesSinValores(secciones: SeccionInforme[]): SeccionInforme[] {
  return secciones.map((s) => ({
    ...s,
    items: s.items.map((i) => ({ ...i, valor: null })),
  }));
}

function esValor(v: unknown): v is ValorInforme {
  return typeof v === "string" && (VALORES_INFORME as readonly string[]).includes(v);
}

/**
 * Normaliza el Json que viene de la base. Descarta lo que no cumpla la forma
 * esperada en vez de confiar en el tipo: el campo es Json y pudo escribirse
 * desde otra versión del catálogo o a mano.
 *
 * El informe es la fuente de verdad de su propia estructura: se devuelve lo que
 * está guardado, en su orden, SIN completarlo contra ninguna plantilla. Antes
 * se reconciliaba contra un catálogo fijo en el código; ahora cada centro tiene
 * el suyo, y reponer secciones de la plantilla vigente dentro de un informe
 * antiguo cambiaría lo que el profesional firmó.
 *
 * Los ids repetidos dentro de una sección se renombran: dos ítems distintos con
 * el mismo id se confunden en la analítica, que empareja por id.
 */
export function normalizarSecciones(valor: unknown): SeccionInforme[] {
  if (!Array.isArray(valor)) return [];

  return valor.flatMap((s): SeccionInforme[] => {
    if (!s || typeof s !== "object") return [];
    const sec = s as Record<string, unknown>;
    if (typeof sec.id !== "string" || !sec.id) return [];

    const vistos = new Set<string>();
    const items: ItemInforme[] = Array.isArray(sec.items)
      ? sec.items.flatMap((i): ItemInforme[] => {
          if (!i || typeof i !== "object") return [];
          const it = i as Record<string, unknown>;
          if (typeof it.id !== "string" || !it.id) return [];
          if (typeof it.label !== "string") return [];
          const label = it.label.trim();
          if (!label) return [];
          let id = it.id;
          while (vistos.has(id)) id = `${id}_dup`;
          vistos.add(id);
          return [{ id, label, valor: esValor(it.valor) ? it.valor : null }];
        })
      : [];

    return [
      {
        id: sec.id,
        titulo:
          typeof sec.titulo === "string" && sec.titulo.trim() ? sec.titulo.trim() : sec.id,
        items,
      },
    ];
  });
}

/** Cuenta de ítems calificados sobre el total, para el resumen del listado. */
export function resumenAvance(secciones: SeccionInforme[]): {
  calificados: number;
  total: number;
} {
  let calificados = 0;
  let total = 0;
  for (const s of secciones) {
    for (const i of s.items) {
      total++;
      if (i.valor) calificados++;
    }
  }
  return { calificados, total };
}
