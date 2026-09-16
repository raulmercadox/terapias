import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarPlantilla, camposDe, idsDuplicados } from "./plantilla";
import { NOMBRES, aplicarEdicion, parseEdicion } from "./editor";

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
