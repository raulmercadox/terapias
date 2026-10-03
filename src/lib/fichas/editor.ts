// Edición de una plantilla desde Configuración › Fichas clínicas.
//
// El editor NO reconstruye la plantilla desde cero: parte de la vigente y le
// superpone lo editado. Así, lo que no se puede tocar en la interfaz —el tipo
// de un campo existente, las escalas, las columnas de una tabla, las
// condiciones `visibleSi`— no puede corromperse desde el formulario aunque
// llegue basura.
//
// Lo editable es:
//   - el TEXTO (títulos de sección y etiquetas de campo) y los ítems de los
//     checklists, que es de donde venía el problema: los ítems estaban
//     redactados para terapia psicológica;
//   - la ESTRUCTURA (con `estructura_completa`): agregar, quitar y reordenar
//     campos y secciones. Los campos nuevos solo pueden ser de los tipos
//     simples (texto, párrafo, casilla, opciones) o una lista evaluable con
//     una escala que ya exista en la plantilla. Quitar un campo no borra lo
//     registrado: la ficha lo muestra como dato antiguo (ver valores.ts).

import { camposDe, normalizarPlantilla } from "./plantilla";
import { esImagenBase, esImagenValida, leyendaDeTexto } from "./mapa";
import type { Campo, Grupo, Plantilla, Seccion } from "./tipos";

/** Tipos que se pueden crear desde el editor. */
export const TIPOS_NUEVOS = ["texto", "parrafo", "casilla", "opciones", "checklist", "mapa"] as const;
export type TipoNuevo = (typeof TIPOS_NUEVOS)[number];

/**
 * Las claves que empiezan con este prefijo son de elementos NUEVOS, inventadas
 * por el cliente solo para relacionar filas del formulario (un campo con su
 * grupo, un ítem con su lista). El id definitivo se genera en el servidor.
 */
export const PREFIJO_NUEVO = "+";

export type CampoEstructura = {
  clave: string;
  label: string;
  /** Clave del grupo donde queda el campo. */
  grupo: string;
  /** Solo campos nuevos. */
  tipo: string;
  /** Opciones nuevas, o la leyenda de un mapa nuevo: una por línea. */
  opciones: string;
  multiple: boolean;
  /** Solo listas nuevas: escala elegida (si la sección no trae una). */
  escala: string;
  /** Solo mapas: imagen de fondo (nueva o cambiada). */
  imagen: string;
};

export type Estructura = {
  /** Secciones en el orden en que quedaron. */
  secciones: { clave: string; titulo: string }[];
  /** Grupos con la sección a la que pertenecen, en orden. */
  grupos: { clave: string; seccion: string }[];
  /** Campos en el orden en que quedaron dentro de su grupo. */
  campos: CampoEstructura[];
};

export type Edicion = {
  /** Título nuevo por id de sección. */
  secciones: Map<string, string>;
  /** Etiqueta nueva por id de campo. */
  campos: Map<string, string>;
  /** Ítems por clave de campo, en el orden en que quedaron. Id vacío = nuevo. */
  items: Map<string, { id: string; label: string }[]>;
  /**
   * Presente solo si el formulario mandó la estructura entera: entonces lo
   * que no viene se quita y el orden es el del formulario. Sin ella, lo que
   * no viene queda como estaba (solo se renombra).
   */
  estructura?: Estructura;
};

export const NOMBRES = {
  estructuraCompleta: "estructura_completa",
  seccionId: "sec_id",
  seccionTitulo: "sec_titulo",
  grupoId: "grupo_id",
  grupoSeccion: "grupo_sec",
  campoId: "campo_id",
  campoLabel: "campo_label",
  campoGrupo: "campo_grupo",
  campoTipo: "campo_tipo",
  campoOpciones: "campo_opciones",
  campoMultiple: "campo_multiple",
  campoEscala: "campo_escala",
  campoImagen: "campo_imagen",
  itemCampo: "item_campo",
  itemId: "item_id",
  itemLabel: "item_label",
} as const;

const texto = (v: FormDataEntryValue | null | undefined) => String(v ?? "").trim();

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

  if (texto(formData.get(NOMBRES.estructuraCompleta)) !== "1") {
    return { secciones, campos, items };
  }

  const grupoIds = formData.getAll(NOMBRES.grupoId);
  const grupoSecs = formData.getAll(NOMBRES.grupoSeccion);
  const campoGrupos = formData.getAll(NOMBRES.campoGrupo);
  const campoTipos = formData.getAll(NOMBRES.campoTipo);
  const campoOpciones = formData.getAll(NOMBRES.campoOpciones);
  const campoMultiples = formData.getAll(NOMBRES.campoMultiple);
  const campoEscalas = formData.getAll(NOMBRES.campoEscala);
  const campoImagenes = formData.getAll(NOMBRES.campoImagen);

  const estructura: Estructura = {
    secciones: secIds.flatMap((id, i) => {
      const clave = texto(id);
      return clave ? [{ clave, titulo: texto(secTitulos[i]) }] : [];
    }),
    grupos: grupoIds.flatMap((id, i) => {
      const clave = texto(id);
      const seccion = texto(grupoSecs[i]);
      return clave && seccion ? [{ clave, seccion }] : [];
    }),
    campos: campoIds.flatMap((id, i) => {
      const clave = texto(id);
      const grupo = texto(campoGrupos[i]);
      if (!clave || !grupo) return [];
      return [
        {
          clave,
          label: texto(campoLabels[i]),
          grupo,
          tipo: texto(campoTipos[i]),
          opciones: String(campoOpciones[i] ?? ""),
          multiple: texto(campoMultiples[i]) === "1",
          escala: texto(campoEscalas[i]),
          imagen: texto(campoImagenes[i]),
        },
      ];
    }),
  };

  return { secciones, campos, items, estructura };
}

/** Id para un ítem nuevo. Se genera en el SERVIDOR: los del cliente dependen
 *  de la posición en el árbol de React y pueden repetirse entre montajes. */
export function idNuevoItem(): string {
  return `it_${Math.random().toString(36).slice(2, 10)}`;
}

const esNuevo = (clave: string) => clave.startsWith(PREFIJO_NUEVO);

/** "Sí, con ayuda" → "SI_CON_AYUDA": el valor que se guarda de una opción. */
function valorDeOpcion(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "OPCION"
  );
}

/** Opciones escritas una por línea, sin repetidas. */
export function opcionesDeTexto(v: string): { valor: string; label: string }[] {
  const vistos = new Set<string>();
  return v.split("\n").flatMap((linea) => {
    const label = linea.trim();
    if (!label) return [];
    const base = valorDeOpcion(label);
    let valor = base;
    for (let n = 2; vistos.has(valor); n++) valor = `${base}_${n}`;
    vistos.add(valor);
    return [{ valor, label }];
  });
}

/**
 * Revisa lo que el editor no puede arreglar solo. Devuelve el primer problema
 * en palabras del usuario, o null si la edición se puede aplicar.
 */
export function validarEdicion(plantilla: Plantilla, edicion: Edicion): string | null {
  const e = edicion.estructura;
  if (!e) return null;

  for (const s of e.secciones) {
    if (esNuevo(s.clave) && !s.titulo) return "Escribe el título de la sección nueva.";
  }

  const escalas = new Set(plantilla.escalas.map((s) => s.id));
  const escalaDeSeccion = new Map(plantilla.secciones.map((s) => [s.id, s.escalaId ?? null]));
  const seccionDeGrupo = new Map(e.grupos.map((g) => [g.clave, g.seccion]));
  // Las secciones nuevas de un informe heredan la escala de la plantilla.
  const seccionesAbiertas = plantilla.secciones.some((s) => s.itemsAbiertos);

  for (const c of e.campos) {
    if (!esNuevo(c.clave)) continue;
    if (!(TIPOS_NUEVOS as readonly string[]).includes(c.tipo)) return "Tipo de campo inválido.";
    if (!c.label && c.tipo !== "checklist") return "Escribe el texto de cada campo nuevo.";
    if (c.tipo === "opciones" && opcionesDeTexto(c.opciones).length < 2) {
      return `El campo «${c.label}» necesita al menos dos opciones, una por línea.`;
    }
    if (c.tipo === "mapa" && !esImagenValida(c.imagen)) {
      return `Elige la imagen del campo «${c.label}».`;
    }
    if (c.tipo === "checklist") {
      const nombre = c.label ? `«${c.label}»` : "nueva";
      if ((edicion.items.get(c.clave) ?? []).length === 0) {
        return `La lista ${nombre} necesita al menos un ítem.`;
      }
      const seccion = seccionDeGrupo.get(c.grupo) ?? "";
      const heredada =
        escalaDeSeccion.get(seccion) ?? (esNuevo(seccion) && seccionesAbiertas ? "plantilla" : null);
      if (!heredada && !escalas.has(c.escala)) {
        return `Elige la escala de la lista ${nombre}.`;
      }
    }
  }
  return null;
}

/**
 * Campos que la plantilla editada perdió pero de los que depende la
 * visibilidad de un grupo que sigue en ella. Quitarlos dejaría ese grupo
 * siempre visible, así que el editor no lo permite.
 */
export function dependenciasRotas(anterior: Plantilla, editada: Plantilla): string | null {
  const quedan = new Set(camposDe(editada).map((c) => c.id));
  for (const seccion of editada.secciones) {
    for (const grupo of seccion.grupos) {
      const cid = grupo.visibleSi?.campoId;
      if (!cid || quedan.has(cid)) continue;
      const campo = camposDe(anterior).find((c) => c.id === cid);
      const nombre = campo?.label ?? cid;
      const de = grupo.titulo ? `«${grupo.titulo}»` : `parte de la sección «${seccion.titulo}»`;
      return `No se puede quitar «${nombre}»: de su respuesta depende que se muestre ${de}.`;
    }
  }
  return null;
}

function conLabel(campo: Campo, label: string | undefined): Campo {
  if (!label) return campo;
  // Los checklists pueden no tener etiqueta; el resto siempre la tiene.
  return { ...campo, label } as Campo;
}

type Items = { id: string; label: string }[];

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

  /** Ítems de un checklist según el formulario; sin entrada, quedan igual. */
  const itemsDe = (clave: string, previos: Items): Items => {
    const editados = edicion.items.get(clave);
    if (!editados) return previos;
    const existentes = new Set(previos.map((i) => i.id));
    return editados.map(({ id, label }) => {
      // Un id que no existía en la plantilla no se acepta del cliente:
      // podría pisar el de otro campo o colarse repetido.
      let final = id && existentes.has(id) && !usados.has(id) ? id : nuevoId();
      while (usados.has(final)) final = nuevoId();
      usados.add(final);
      return { id: final, label };
    });
  };

  const editarCampo = (campo: Campo): Campo => {
    const conNuevaEtiqueta = conLabel(campo, edicion.campos.get(campo.id));
    if (conNuevaEtiqueta.tipo !== "checklist") return conNuevaEtiqueta;
    return { ...conNuevaEtiqueta, items: itemsDe(campo.id, conNuevaEtiqueta.items) };
  };

  const secciones = edicion.estructura
    ? reestructurar(plantilla, edicion.estructura, editarCampo, itemsDe, nuevoId)
    : plantilla.secciones.map((seccion) => ({
        ...seccion,
        titulo: edicion.secciones.get(seccion.id) ?? seccion.titulo,
        grupos: seccion.grupos.map((grupo) => ({
          ...grupo,
          campos: grupo.campos.map(editarCampo),
        })),
      }));

  // Se sanea igual que cualquier Json que entre al sistema. Lo que quedó
  // vacío (un grupo sin campos, una sección sin grupos) se descarta aquí.
  return normalizarPlantilla({ ...plantilla, secciones });
}

/** Arma las secciones en el orden y con el contenido que mandó el formulario. */
function reestructurar(
  plantilla: Plantilla,
  e: Estructura,
  editarCampo: (c: Campo) => Campo,
  itemsDe: (clave: string, previos: Items) => Items,
  nuevoId: () => string,
): Seccion[] {
  // Todo id ya presente en la plantilla queda reservado para los nuevos.
  const ocupados = new Set<string>();
  const seccionPrevia = new Map<string, Seccion>();
  const grupoPrevio = new Map<string, Grupo>();
  const campoPrevio = new Map<string, Campo>();
  for (const s of plantilla.secciones) {
    ocupados.add(s.id);
    seccionPrevia.set(s.id, s);
    for (const g of s.grupos) {
      ocupados.add(g.id);
      grupoPrevio.set(g.id, g);
      for (const c of g.campos) {
        ocupados.add(c.id);
        campoPrevio.set(c.id, c);
        if (c.tipo === "checklist") for (const i of c.items) ocupados.add(i.id);
      }
    }
  }
  // El generador de ítems ya trae su prefijo ("it_"): se cambia por el del tipo.
  const generar = (prefijo: string) => `${prefijo}${nuevoId().replace(/^it_/, "")}`;
  const idLibre = (prefijo: string) => {
    let id = generar(prefijo);
    while (ocupados.has(id)) id = generar(prefijo);
    ocupados.add(id);
    return id;
  };

  // En un informe todas las secciones aceptan ítems en cada ficha: las nuevas
  // también, y usan la escala de la plantilla.
  const seccionesAbiertas = plantilla.secciones.some((s) => s.itemsAbiertos);

  // Clave del formulario → elemento resultante. Cada elemento previo se usa
  // una sola vez: una clave repetida no lo duplica.
  const secciones = new Map<string, Seccion>();
  for (const { clave, titulo } of e.secciones) {
    if (secciones.has(clave)) continue;
    const previa = seccionPrevia.get(clave);
    if (previa) {
      secciones.set(clave, { ...previa, titulo: titulo || previa.titulo, grupos: [] });
    } else if (esNuevo(clave) && titulo) {
      secciones.set(clave, {
        id: idLibre("sec_"),
        titulo,
        escalaId: seccionesAbiertas ? (plantilla.escalas[0]?.id ?? null) : null,
        conObservacion: !seccionesAbiertas,
        itemsAbiertos: seccionesAbiertas,
        grupos: [],
      });
    }
  }

  const grupos = new Map<string, { grupo: Grupo; escalaSeccion: string | null }>();
  for (const { clave, seccion } of e.grupos) {
    const destino = secciones.get(seccion);
    if (!destino || grupos.has(clave)) continue;
    const previo = grupoPrevio.get(clave);
    const grupo: Grupo | null = previo
      ? { ...previo, campos: [] }
      : esNuevo(clave)
        ? { id: idLibre("g_"), titulo: null, campos: [] }
        : null;
    if (!grupo) continue;
    grupos.set(clave, { grupo, escalaSeccion: destino.escalaId ?? null });
    destino.grupos.push(grupo);
  }

  const escalas = new Set(plantilla.escalas.map((s) => s.id));
  const colocados = new Set<string>();

  for (const c of e.campos) {
    const destino = grupos.get(c.grupo);
    if (!destino || colocados.has(c.clave)) continue;
    colocados.add(c.clave);
    const { grupo, escalaSeccion } = destino;

    const previo = campoPrevio.get(c.clave);
    if (previo) {
      const editado = editarCampo(previo);
      // De un mapa se puede cambiar la imagen: lo ya dibujado guarda la suya.
      grupo.campos.push(
        editado.tipo === "mapa" && esImagenValida(c.imagen)
          ? { ...editado, imagenId: c.imagen }
          : editado,
      );
      continue;
    }
    if (!esNuevo(c.clave)) continue;

    const id = idLibre("cp_");
    switch (c.tipo) {
      case "texto":
      case "parrafo":
      case "casilla":
        grupo.campos.push({ tipo: c.tipo, id, label: c.label });
        break;
      case "opciones":
        grupo.campos.push({
          tipo: "opciones",
          id,
          label: c.label,
          multiple: c.multiple,
          opciones: opcionesDeTexto(c.opciones),
        });
        break;
      case "mapa":
        grupo.campos.push({
          tipo: "mapa",
          id,
          label: c.label,
          imagenId: c.imagen,
          leyenda: leyendaDeTexto(c.opciones),
        });
        break;
      case "checklist":
        grupo.campos.push({
          tipo: "checklist",
          id,
          label: c.label || null,
          // Si la sección ya define la escala, la lista la hereda.
          escalaId: escalaSeccion ? undefined : escalas.has(c.escala) ? c.escala : undefined,
          items: itemsDe(c.clave, []),
        });
        break;
    }
  }

  return [...secciones.values()];
}

/**
 * Imágenes subidas (no de fábrica) que usa una plantilla. El servidor verifica
 * que sean del centro antes de guardar: el id llega desde el formulario.
 */
export function imagenesSubidas(plantilla: Plantilla): string[] {
  return [
    ...new Set(
      camposDe(plantilla).flatMap((c) =>
        c.tipo === "mapa" && !esImagenBase(c.imagenId) ? [c.imagenId] : [],
      ),
    ),
  ];
}
