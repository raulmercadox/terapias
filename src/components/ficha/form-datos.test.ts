import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarPlantilla } from "@/lib/fichas/plantilla";
import {
  nombreCampo,
  nombreColumna,
  nombreItem,
  nombreObs,
  parseValores,
} from "./form-datos";

const plantilla = normalizarPlantilla({
  escalas: [{ id: "IPL", valores: ["I", "P", "L"], labels: { I: "Inicio", P: "Proceso", L: "Logrado" } }],
  secciones: [
    {
      id: "datos",
      titulo: "Datos",
      grupos: [
        {
          id: "g",
          campos: [
            { tipo: "texto", id: "lugar", label: "Lugar" },
            { tipo: "parrafo", id: "nota", label: "Nota" },
            { tipo: "casilla", id: "acepta", label: "Acepta" },
            {
              tipo: "opciones",
              id: "modalidad",
              label: "Modalidad",
              multiple: false,
              opciones: [{ valor: "VERBAL", label: "Verbal" }, { valor: "NO_VERBAL", label: "No verbal" }],
            },
            {
              tipo: "opciones",
              id: "reacciones",
              label: "Reacciones",
              multiple: true,
              opciones: [{ valor: "RECHAZO", label: "Rechazo" }, { valor: "APOYO", label: "Apoyo" }],
            },
            {
              tipo: "tabla",
              id: "familiares",
              label: "Familiares",
              columnas: [{ id: "parentesco", label: "Parentesco" }, { id: "nombres", label: "Nombres" }],
            },
          ],
        },
      ],
    },
    {
      id: "area",
      titulo: "Área",
      escalaId: "IPL",
      conObservacion: true,
      grupos: [
        {
          id: "verbal",
          visibleSi: { campoId: "modalidad", valores: ["VERBAL"] },
          campos: [{ tipo: "checklist", id: "chk_verbal", items: [{ id: "v1", label: "Ecolalia" }] }],
        },
        {
          id: "general",
          campos: [
            {
              tipo: "checklist",
              id: "chk_gen",
              items: [
                { id: "g1", label: "Contacto visual" },
                { id: "g2", label: "Mirada sostenida" },
              ],
            },
          ],
        },
      ],
    },
  ],
});

/** FormData como la enviaría el formulario que arma FichaForm. */
function form(entradas: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entradas) fd.append(k, v);
  return fd;
}

test("reconstruye cada tipo de campo desde el FormData", () => {
  const v = parseValores(
    form([
      [nombreCampo("lugar"), "Lima"],
      [nombreCampo("nota"), "  con espacios  "],
      [nombreCampo("acepta"), "on"],
      [nombreCampo("modalidad"), "VERBAL"],
      [nombreCampo("reacciones"), "RECHAZO"],
      [nombreCampo("reacciones"), "APOYO"],
      [nombreColumna("familiares", "parentesco"), "Padre"],
      [nombreColumna("familiares", "nombres"), "Juan"],
      [nombreItem("g1"), "L"],
      [nombreObs("g1"), "constante"],
      [nombreItem("g2"), ""],
      [nombreObs("g2"), ""],
    ]),
    plantilla,
  );

  assert.deepEqual(v.lugar, { t: "texto", v: "Lima" });
  assert.deepEqual(v.nota, { t: "texto", v: "con espacios" });
  assert.deepEqual(v.acepta, { t: "casilla", v: true });
  assert.deepEqual(v.modalidad, { t: "opciones", v: ["VERBAL"] });
  assert.deepEqual(v.reacciones, { t: "opciones", v: ["RECHAZO", "APOYO"] });
  assert.deepEqual(v.familiares, { t: "tabla", filas: [{ parentesco: "Padre", nombres: "Juan" }] });
  // g2 no se calificó ni se observó: no se guarda.
  assert.deepEqual(v.chk_gen, { t: "checklist", items: { g1: { valor: "L", obs: "constante" } } });
});

test("una casilla que no viaja queda sin marcar", () => {
  // Un checkbox desmarcado no aparece en el FormData.
  const v = parseValores(form([[nombreCampo("lugar"), "Lima"]]), plantilla);
  assert.equal(v.acepta, undefined);
});

test("las filas de la tabla se alinean por índice y las vacías se descartan", () => {
  const v = parseValores(
    form([
      [nombreColumna("familiares", "parentesco"), "Padre"],
      [nombreColumna("familiares", "parentesco"), ""],
      [nombreColumna("familiares", "parentesco"), "Madre"],
      [nombreColumna("familiares", "nombres"), "Juan"],
      [nombreColumna("familiares", "nombres"), ""],
      [nombreColumna("familiares", "nombres"), "Ana"],
    ]),
    plantilla,
  );
  assert.deepEqual(v.familiares, {
    t: "tabla",
    filas: [
      { parentesco: "Padre", nombres: "Juan" },
      { parentesco: "Madre", nombres: "Ana" },
    ],
  });
});

test("no se guarda lo del grupo que la condición dejó fuera", () => {
  // El formulario oculta el grupo verbal pero igual envía sus inputs.
  const v = parseValores(
    form([
      [nombreCampo("modalidad"), "NO_VERBAL"],
      [nombreItem("v1"), "L"],
      [nombreItem("g1"), "P"],
    ]),
    plantilla,
  );
  assert.equal(v.chk_verbal, undefined);
  assert.deepEqual(v.chk_gen, { t: "checklist", items: { g1: { valor: "P" } } });
});

test("con la condición cumplida sí se guarda", () => {
  const v = parseValores(
    form([
      [nombreCampo("modalidad"), "VERBAL"],
      [nombreItem("v1"), "L"],
    ]),
    plantilla,
  );
  assert.deepEqual(v.chk_verbal, { t: "checklist", items: { v1: { valor: "L" } } });
});

test("un formulario vacío no inventa valores", () => {
  assert.deepEqual(parseValores(new FormData(), plantilla), {});
});

test("un valor fuera del dominio de la escala se descarta", () => {
  const v = parseValores(form([[nombreItem("g1"), "X"]]), plantilla);
  assert.equal(v.chk_gen, undefined);
});
