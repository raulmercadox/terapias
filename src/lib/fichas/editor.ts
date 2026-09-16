// Edición de una plantilla desde Configuración › Fichas clínicas.
//
// El editor NO reconstruye la plantilla desde cero: parte de la vigente y le
// superpone lo editado. Así, lo que no se puede tocar en la interfaz —el tipo
// de cada campo, las escalas, las columnas de una tabla, las condiciones
// `visibleSi`— no puede corromperse desde el formulario aunque llegue basura.
//
// Lo editable es el TEXTO (títulos de sección y etiquetas de campo) y los ítems
// de los checklists, que es de donde venía el problema: los ítems estaban
// redactados para terapia psicológica.

import { normalizarPlantilla } from "./plantilla";
import type { Campo, Plantilla } from "./tipos";

export type Edicion = {
  /** Título nuevo por id de sección. */
  secciones: Map<string, string>;
  /** Etiqueta nueva por id de campo. */
  campos: Map<string, string>;
  /** Ítems por id de campo, en el orden en que quedaron. Id vacío = nuevo. */
  items: Map<string, { id: string; label: string }[]>;
};

export const NOMBRES = {
  seccionId: "sec_id",
  seccionTitulo: "sec_titulo",
  campoId: "campo_id",
  campoLabel: "campo_label",
  itemCampo: "item_campo",
  itemId: "item_id",
  itemLabel: "item_label",
} as const;

const texto = (v: FormDataEntryValue | undefined) => String(v ?? "").trim();

/**
 * Lee lo editado del FormData. Los campos paralelos se alinean por índice, la
 * misma disciplina que usa el informe de avance: cada ítem manda su campo, su
 * id (vacío si es nuevo) y su etiqueta.
 */
export function parseEdicion(formData: FormData): Edicion {
  const secciones = new Map<string, string>();
  const secIds = formData.getAll(NOMBRES.seccionId);
  const secTitulos = formData.getAll(NOMBRES.seccionTitulo);
  secIds.forEach((id, i) => {
    const sid = texto(id);
    const titulo = texto(secTitulos[i]);
    if (sid && titulo) secciones.set(sid, titulo);
  });

  const campos = new Map<string, string>();
  const campoIds = formData.getAll(NOMBRES.campoId);
  const campoLabels = formData.getAll(NOMBRES.campoLabel);
  campoIds.forEach((id, i) => {
    const cid = texto(id);
    const label = texto(campoLabels[i]);
    if (cid && label) campos.set(cid, label);
  });

  const items = new Map<string, { id: string; label: string }[]>();
  const itemCampos = formData.getAll(NOMBRES.itemCampo);
  const itemIds = formData.getAll(NOMBRES.itemId);
  const itemLabels = formData.getAll(NOMBRES.itemLabel);
  itemCampos.forEach((campo, i) => {
    const cid = texto(campo);
    const label = texto(itemLabels[i]);
    // Sin etiqueta el ítem se elimina: es como se borra una fila.
    if (!cid || !label) return;
    const lista = items.get(cid) ?? [];
    lista.push({ id: texto(itemIds[i]), label });
    items.set(cid, lista);
  });

  return { secciones, campos, items };
}

/** Id para un ítem nuevo. Se genera en el SERVIDOR: los del cliente dependen
 *  de la posición en el árbol de React y pueden repetirse entre montajes. */
export function idNuevoItem(): string {
  return `it_${Math.random().toString(36).slice(2, 10)}`;
}

function conLabel(campo: Campo, label: string | undefined): Campo {
  if (!label) return campo;
  // Los checklists pueden no tener etiqueta; el resto siempre la tiene.
  return { ...campo, label } as Campo;
}

/**
 * Superpone lo editado sobre la plantilla vigente.
 *
 * Los ids de los ítems que ya existían se conservan tal cual: la analítica de
 * progreso empareja los informes por id, así que renombrarlos rompería la serie
 * histórica de los pacientes. Solo los ítems nuevos reciben un id.
 */
export function aplicarEdicion(
  plantilla: Plantilla,
  edicion: Edicion,
  nuevoId: () => string = idNuevoItem,
): Plantilla {
  const usados = new Set<string>();

  const secciones = plantilla.secciones.map((seccion) => ({
    ...seccion,
    titulo: edicion.secciones.get(seccion.id) ?? seccion.titulo,
    grupos: seccion.grupos.map((grupo) => ({
      ...grupo,
      campos: grupo.campos.map((campo): Campo => {
        const conNuevaEtiqueta = conLabel(campo, edicion.campos.get(campo.id));
        if (conNuevaEtiqueta.tipo !== "checklist") return conNuevaEtiqueta;

        const editados = edicion.items.get(campo.id);
        // Sin entrada en el formulario, el checklist queda como estaba.
        if (!editados) return conNuevaEtiqueta;

        const previos = new Set(conNuevaEtiqueta.items.map((i) => i.id));
        const items = editados.map(({ id, label }) => {
          // Un id que no existía en la plantilla no se acepta del cliente:
          // podría pisar el de otro campo o colarse repetido.
          let final = id && previos.has(id) && !usados.has(id) ? id : nuevoId();
          while (usados.has(final)) final = nuevoId();
          usados.add(final);
          return { id: final, label };
        });
        return { ...conNuevaEtiqueta, items };
      }),
    })),
  }));

  // Se sanea igual que cualquier Json que entre al sistema.
  return normalizarPlantilla({ ...plantilla, secciones });
}
