import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarPlantilla, camposDe, idsDuplicados } from "./plantilla";
import {
  NOMBRES,
  aplicarEdicion,
  dependenciasRotas,
  opcionesDeTexto,
  parseEdicion,
  validarEdicion,
} from "./editor";

const plantilla = normalizarPlantilla({
  escalas: [{ id: "IPL", valores: ["I", "P", "L"], labels: {} }],
  secciones: [
    {
      id: "datos",
      titulo: "Datos generales",
      grupos: [
        {
          id: "g",
          campos: [
            { tipo: "texto", id: "lugar", label: "Lugar de nacimiento" },
            { tipo: "tabla", id: "familiares", label: "Familiares", columnas: [{ id: "c", label: "C" }] },
          ],
        },
      ],
    },
    {
      id: "area",
      titulo: "Área conductual",
      escalaId: "IPL",
      conObservacion: true,
      grupos: [
        {
          id: "g2",
          visibleSi: { campoId: "lugar", valores: ["X"] },
          campos: [
            {
              tipo: "checklist",
              id: "chk",
              items: [
                { id: "i1", label: "Contacto visual" },
                { id: "i2", label: "Mirada sostenida" },
              ],
            },
          ],
        },
      ],
    },
  ],
});

/** FormData como la enviaría el editor. */
function form(entradas: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entradas) fd.append(k, v);
  return fd;
}

/** Ids predecibles, para poder afirmar sobre ellos. */
function contador() {
  let n = 0;
  return () => `nuevo${++n}`;
}

test("parseEdicion alinea ítems con su campo por índice", () => {
  const e = parseEdicion(
    form([
      [NOMBRES.seccionId, "datos"], [NOMBRES.seccionTitulo, "Datos"],
      [NOMBRES.campoId, "lugar"], [NOMBRES.campoLabel, "Lugar"],
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "i1"], [NOMBRES.itemLabel, "Uno"],
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, ""], [NOMBRES.itemLabel, "Dos"],
    ]),
  );

  assert.equal(e.secciones.get("datos"), "Datos");
  assert.equal(e.campos.get("lugar"), "Lugar");
  assert.deepEqual(e.items.get("chk"), [
    { id: "i1", label: "Uno" },
    { id: "", label: "Dos" },
  ]);
});

test("un ítem sin etiqueta se descarta: así se borra una fila", () => {
  const e = parseEdicion(
    form([
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "i1"], [NOMBRES.itemLabel, "Queda"],
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "i2"], [NOMBRES.itemLabel, "   "],
    ]),
  );
  assert.deepEqual(e.items.get("chk"), [{ id: "i1", label: "Queda" }]);
});

test("renombrar secciones, campos e ítems conserva los ids", () => {
  const e = parseEdicion(
    form([
      [NOMBRES.seccionId, "area"], [NOMBRES.seccionTitulo, "Evaluación funcional"],
      [NOMBRES.campoId, "lugar"], [NOMBRES.campoLabel, "Ciudad de nacimiento"],
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "i1"], [NOMBRES.itemLabel, "Seguimiento de la mirada"],
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "i2"], [NOMBRES.itemLabel, "Mirada sostenida"],
    ]),
  );
  const p = aplicarEdicion(plantilla, e, contador());

  assert.equal(p.secciones[1].titulo, "Evaluación funcional");
  const lugar = camposDe(p).find((c) => c.id === "lugar");
  assert.equal(lugar?.tipo === "texto" ? lugar.label : null, "Ciudad de nacimiento");

  const chk = camposDe(p).find((c) => c.id === "chk");
  assert.ok(chk?.tipo === "checklist");
  assert.deepEqual(chk.items, [
    { id: "i1", label: "Seguimiento de la mirada" },
    { id: "i2", label: "Mirada sostenida" },
  ]);
});

test("un ítem nuevo recibe su id en el servidor; los viejos no cambian", () => {
  const e = parseEdicion(
    form([
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "i1"], [NOMBRES.itemLabel, "Contacto visual"],
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, ""], [NOMBRES.itemLabel, "Dolor referido"],
    ]),
  );
  const p = aplicarEdicion(plantilla, e, contador());
  const chk = camposDe(p).find((c) => c.id === "chk");
  assert.ok(chk?.tipo === "checklist");
  assert.deepEqual(chk.items, [
    { id: "i1", label: "Contacto visual" },
    { id: "nuevo1", label: "Dolor referido" },
  ]);
});

test("quitar un ítem no toca el id de los demás", () => {
  const e = parseEdicion(
    form([[NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "i2"], [NOMBRES.itemLabel, "Mirada sostenida"]]),
  );
  const p = aplicarEdicion(plantilla, e, contador());
  const chk = camposDe(p).find((c) => c.id === "chk");
  assert.ok(chk?.tipo === "checklist");
  assert.deepEqual(chk.items, [{ id: "i2", label: "Mirada sostenida" }]);
});

test("un id inventado por el cliente no se acepta: se genera uno nuevo", () => {
  // Defensa: si el id no estaba en la plantilla, podría pisar el de otro campo.
  const e = parseEdicion(
    form([[NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "len_comprensivo"], [NOMBRES.itemLabel, "Colado"]]),
  );
  const p = aplicarEdicion(plantilla, e, contador());
  const chk = camposDe(p).find((c) => c.id === "chk");
  assert.ok(chk?.tipo === "checklist");
  assert.deepEqual(chk.items, [{ id: "nuevo1", label: "Colado" }]);
});

test("un id repetido dos veces solo se conserva la primera vez", () => {
  const e = parseEdicion(
    form([
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "i1"], [NOMBRES.itemLabel, "Uno"],
      [NOMBRES.itemCampo, "chk"], [NOMBRES.itemId, "i1"], [NOMBRES.itemLabel, "Duplicado"],
    ]),
  );
  const p = aplicarEdicion(plantilla, e, contador());
  const chk = camposDe(p).find((c) => c.id === "chk");
  assert.ok(chk?.tipo === "checklist");
  assert.deepEqual(chk.items, [
    { id: "i1", label: "Uno" },
    { id: "nuevo1", label: "Duplicado" },
  ]);
  assert.deepEqual(idsDuplicados(p), []);
});

test("lo que el editor no toca no se puede corromper desde el formulario", () => {
  // El formulario no manda tipos, escalas, columnas ni condiciones: la plantilla
  // editada las hereda de la vigente.
  const e = parseEdicion(form([[NOMBRES.seccionId, "area"], [NOMBRES.seccionTitulo, "Otra cosa"]]));
  const p = aplicarEdicion(plantilla, e, contador());

  assert.deepEqual(p.escalas, plantilla.escalas);
  assert.equal(p.secciones[1].escalaId, "IPL");
  assert.equal(p.secciones[1].conObservacion, true);
  assert.deepEqual(p.secciones[1].grupos[0].visibleSi, { campoId: "lugar", valores: ["X"] });
  const tabla = camposDe(p).find((c) => c.id === "familiares");
  assert.equal(tabla?.tipo, "tabla");
  // Se comprueban los datos de la columna, no la forma exacta del objeto: el
  // saneador deja las opciones ausentes como claves en `undefined`, que al
  // guardarse como Json desaparecen y al releerse se vuelven a añadir.
  assert.deepEqual(
    tabla?.tipo === "tabla" ? tabla.columnas.map((c) => [c.id, c.label]) : null,
    [["c", "C"]],
  );
});

test("un formulario vacío deja la plantilla como estaba", () => {
  const p = aplicarEdicion(plantilla, parseEdicion(new FormData()), contador());
  assert.deepEqual(p, plantilla);
});

/* ── Estructura: agregar, quitar y reordenar ──────────── */

type FilaCampo = {
  clave: string;
  label?: string;
  grupo: string;
  tipo?: string;
  opciones?: string;
  multiple?: boolean;
  escala?: string;
};

/** FormData de estructura completa, como lo manda el editor. */
function estructura(
  secciones: [string, string][],
  grupos: [string, string][],
  campos: FilaCampo[],
  items: [string, string, string][] = [],
): FormData {
  const e: [string, string][] = [[NOMBRES.estructuraCompleta, "1"]];
  for (const [id, titulo] of secciones) e.push([NOMBRES.seccionId, id], [NOMBRES.seccionTitulo, titulo]);
  for (const [id, sec] of grupos) e.push([NOMBRES.grupoId, id], [NOMBRES.grupoSeccion, sec]);
  for (const c of campos) {
    e.push(
      [NOMBRES.campoId, c.clave],
      [NOMBRES.campoLabel, c.label ?? ""],
      [NOMBRES.campoGrupo, c.grupo],
      [NOMBRES.campoTipo, c.tipo ?? ""],
      [NOMBRES.campoOpciones, c.opciones ?? ""],
      [NOMBRES.campoMultiple, c.multiple ? "1" : ""],
      [NOMBRES.campoEscala, c.escala ?? ""],
    );
  }
  for (const [campo, id, label] of items) {
    e.push([NOMBRES.itemCampo, campo], [NOMBRES.itemId, id], [NOMBRES.itemLabel, label]);
  }
  return form(e);
}

/** La plantilla tal cual, en modo estructura (punto de partida de cada caso). */
const SECCIONES: [string, string][] = [["datos", "Datos generales"], ["area", "Área conductual"]];
const GRUPOS: [string, string][] = [["g", "datos"], ["g2", "area"]];
const CAMPOS: FilaCampo[] = [
  { clave: "lugar", label: "Lugar de nacimiento", grupo: "g" },
  { clave: "familiares", label: "Familiares", grupo: "g" },
  { clave: "chk", grupo: "g2" },
];

test("la estructura sin cambios deja la plantilla como estaba", () => {
  const p = aplicarEdicion(plantilla, parseEdicion(estructura(SECCIONES, GRUPOS, CAMPOS)), contador());
  assert.deepEqual(p, plantilla);
});

test("agregar un campo de texto le da un id del servidor en su lugar", () => {
  const e = parseEdicion(
    estructura(SECCIONES, GRUPOS, [
      CAMPOS[0],
      { clave: "+c1", label: "Seguro médico", grupo: "g", tipo: "texto" },
      ...CAMPOS.slice(1),
    ]),
  );
  assert.equal(validarEdicion(plantilla, e), null);
  const p = aplicarEdicion(plantilla, e, contador());
  assert.deepEqual(
    p.secciones[0].grupos[0].campos.map((c) => [c.id, c.tipo, c.label]),
    [
      ["lugar", "texto", "Lugar de nacimiento"],
      ["cp_nuevo1", "texto", "Seguro médico"],
      ["familiares", "tabla", "Familiares"],
    ],
  );
});

test("un campo de opciones nuevo arma sus valores desde las líneas", () => {
  const e = parseEdicion(
    estructura(SECCIONES, GRUPOS, [
      ...CAMPOS,
      { clave: "+c1", label: "¿Usa órtesis?", grupo: "g", tipo: "opciones", opciones: "Sí\nNo\n\n Sí ", multiple: true },
    ]),
  );
  const p = aplicarEdicion(plantilla, e, contador());
  const nuevo = camposDe(p).find((c) => c.label === "¿Usa órtesis?");
  assert.ok(nuevo?.tipo === "opciones");
  assert.equal(nuevo.multiple, true);
  assert.deepEqual(nuevo.opciones, [
    { valor: "SI", label: "Sí" },
    { valor: "NO", label: "No" },
    { valor: "SI_2", label: "Sí" },
  ]);
});

test("opcionesDeTexto descarta líneas vacías", () => {
  assert.deepEqual(opcionesDeTexto("\n  \nLeve\n"), [{ valor: "LEVE", label: "Leve" }]);
});

test("quitar un campo lo saca de la plantilla", () => {
  const e = parseEdicion(estructura(SECCIONES, GRUPOS, [CAMPOS[0], CAMPOS[2]]));
  const p = aplicarEdicion(plantilla, e, contador());
  assert.equal(camposDe(p).some((c) => c.id === "familiares"), false);
  assert.equal(dependenciasRotas(plantilla, p), null);
});

test("no se puede quitar un campo del que depende la visibilidad de un grupo", () => {
  const e = parseEdicion(estructura(SECCIONES, GRUPOS, CAMPOS.slice(1)));
  const p = aplicarEdicion(plantilla, e, contador());
  assert.match(dependenciasRotas(plantilla, p) ?? "", /Lugar de nacimiento/);
});

test("quitar una sección (y su grupo) la elimina", () => {
  const e = parseEdicion(estructura([SECCIONES[0]], [GRUPOS[0]], CAMPOS.slice(0, 2)));
  const p = aplicarEdicion(plantilla, e, contador());
  assert.deepEqual(p.secciones.map((s) => s.id), ["datos"]);
});

test("una sección sin campos desaparece al guardar", () => {
  const e = parseEdicion(estructura(SECCIONES, GRUPOS, CAMPOS.slice(0, 2)));
  const p = aplicarEdicion(plantilla, e, contador());
  assert.deepEqual(p.secciones.map((s) => s.id), ["datos"]);
});

test("reordenar secciones y campos sigue el orden del formulario", () => {
  const e = parseEdicion(
    estructura([SECCIONES[1], SECCIONES[0]], [GRUPOS[1], GRUPOS[0]], [CAMPOS[2], CAMPOS[1], CAMPOS[0]]),
  );
  const p = aplicarEdicion(plantilla, e, contador());
  assert.deepEqual(p.secciones.map((s) => s.id), ["area", "datos"]);
  assert.deepEqual(p.secciones[1].grupos[0].campos.map((c) => c.id), ["familiares", "lugar"]);
  // Lo que no se edita viaja con su sección.
  assert.equal(p.secciones[0].escalaId, "IPL");
  assert.deepEqual(p.secciones[0].grupos[0].visibleSi, { campoId: "lugar", valores: ["X"] });
});

test("una sección nueva con una lista evaluable usa la escala elegida", () => {
  const e = parseEdicion(
    estructura(
      [...SECCIONES, ["+s1", "Equilibrio"]],
      [...GRUPOS, ["+g1", "+s1"]],
      [...CAMPOS, { clave: "+c1", grupo: "+g1", tipo: "checklist", escala: "IPL" }],
      [["+c1", "", "Apoyo monopodal"], ["+c1", "", "Marcha en tándem"]],
    ),
  );
  assert.equal(validarEdicion(plantilla, e), null);
  const p = aplicarEdicion(plantilla, e, contador());
  assert.equal(p.secciones.length, 3);
  const nueva = p.secciones[2];
  assert.equal(nueva.titulo, "Equilibrio");
  assert.match(nueva.id, /^sec_/);
  const lista = nueva.grupos[0].campos[0];
  assert.ok(lista.tipo === "checklist");
  assert.equal(lista.escalaId, "IPL");
  assert.deepEqual(lista.items.map((i) => i.label), ["Apoyo monopodal", "Marcha en tándem"]);
  assert.deepEqual(idsDuplicados(p), []);
});

test("validarEdicion explica lo que falta en los elementos nuevos", () => {
  const sinTitulo = parseEdicion(estructura([...SECCIONES, ["+s1", ""]], GRUPOS, CAMPOS));
  assert.match(validarEdicion(plantilla, sinTitulo) ?? "", /título/);

  const sinTexto = parseEdicion(estructura(SECCIONES, GRUPOS, [...CAMPOS, { clave: "+c1", grupo: "g", tipo: "texto" }]));
  assert.match(validarEdicion(plantilla, sinTexto) ?? "", /texto/);

  const unaOpcion = parseEdicion(
    estructura(SECCIONES, GRUPOS, [...CAMPOS, { clave: "+c1", label: "X", grupo: "g", tipo: "opciones", opciones: "Sí" }]),
  );
  assert.match(validarEdicion(plantilla, unaOpcion) ?? "", /dos opciones/);

  const listaVacia = parseEdicion(
    estructura(SECCIONES, GRUPOS, [...CAMPOS, { clave: "+c1", grupo: "g2", tipo: "checklist" }]),
  );
  assert.match(validarEdicion(plantilla, listaVacia) ?? "", /ítem/);

  const sinEscala = parseEdicion(
    estructura(SECCIONES, GRUPOS, [...CAMPOS, { clave: "+c1", grupo: "g", tipo: "checklist" }], [["+c1", "", "Uno"]]),
  );
  assert.match(validarEdicion(plantilla, sinEscala) ?? "", /escala/);

  const tipoRaro = parseEdicion(
    estructura(SECCIONES, GRUPOS, [...CAMPOS, { clave: "+c1", label: "X", grupo: "g", tipo: "tabla" }]),
  );
  assert.match(validarEdicion(plantilla, tipoRaro) ?? "", /inválido/);
});

test("una clave inventada que no es nueva ni existe se ignora", () => {
  const e = parseEdicion(
    estructura(SECCIONES, GRUPOS, [...CAMPOS, { clave: "len_comprensivo", label: "Colado", grupo: "g", tipo: "texto" }]),
  );
  const p = aplicarEdicion(plantilla, e, contador());
  assert.equal(camposDe(p).some((c) => c.label === "Colado"), false);
});

test("un campo repetido en el formulario no se duplica", () => {
  const e = parseEdicion(estructura(SECCIONES, GRUPOS, [...CAMPOS, CAMPOS[0]]));
  const p = aplicarEdicion(plantilla, e, contador());
  assert.equal(camposDe(p).filter((c) => c.id === "lugar").length, 1);
});
