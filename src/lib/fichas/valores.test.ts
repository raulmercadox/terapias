import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarPlantilla } from "./plantilla";
import { huerfanos, normalizarValores, tieneDatos } from "./valores";

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
            { tipo: "texto", id: "lugar", label: "Lugar de nacimiento" },
            { tipo: "parrafo", id: "nota", label: "Nota" },
            { tipo: "casilla", id: "convive", label: "Convive con la madre" },
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
              label: "Reacción",
              multiple: true,
              opciones: [{ valor: "RECHAZO", label: "Rechazo" }, { valor: "APOYO", label: "Apoyo" }],
            },
            {
              tipo: "tabla",
              id: "familiares",
              label: "Historia familiar",
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
          campos: [{ tipo: "checklist", id: "chk_gen", items: [{ id: "g1", label: "Contacto visual" }] }],
        },
      ],
    },
  ],
});

test("cada tipo de campo se guarda con su forma", () => {
  const v = normalizarValores(
    {
      lugar: "Lima",
      nota: "  con espacios  ",
      convive: true,
      modalidad: "VERBAL",
      reacciones: ["RECHAZO", "APOYO"],
      familiares: [{ parentesco: "Padre", nombres: "Juan" }],
      chk_gen: { g1: { valor: "L", obs: "constante" } },
    },
    plantilla,
  );
  assert.deepEqual(v.lugar, { t: "texto", v: "Lima" });
  assert.deepEqual(v.nota, { t: "texto", v: "con espacios" });
  assert.deepEqual(v.convive, { t: "casilla", v: true });
  assert.deepEqual(v.modalidad, { t: "opciones", v: ["VERBAL"] });
  assert.deepEqual(v.reacciones, { t: "opciones", v: ["RECHAZO", "APOYO"] });
  assert.deepEqual(v.familiares, { t: "tabla", filas: [{ parentesco: "Padre", nombres: "Juan" }] });
  assert.deepEqual(v.chk_gen, { t: "checklist", items: { g1: { valor: "L", obs: "constante" } } });
});

test("lo vacío no se guarda", () => {
  const v = normalizarValores(
    { lugar: "   ", convive: false, reacciones: [], familiares: [], chk_gen: {} },
    plantilla,
  );
  assert.deepEqual(v, {});
  assert.equal(tieneDatos(v), false);
});

test("un valor fuera del dominio se descarta", () => {
  // "X" no está en la escala IPL y "OTRO" no es una opción declarada.
  const v = normalizarValores(
    { chk_gen: { g1: { valor: "X" } }, modalidad: "OTRO", reacciones: ["INVENTADA"] },
    plantilla,
  );
  assert.equal(v.chk_gen, undefined);
  assert.equal(v.modalidad, undefined);
  assert.equal(v.reacciones, undefined);
});

test("un ítem con observación pero sin calificar sí se guarda", () => {
  const v = normalizarValores({ chk_gen: { g1: { obs: "no evaluado hoy" } } }, plantilla);
  assert.deepEqual(v.chk_gen, { t: "checklist", items: { g1: { obs: "no evaluado hoy" } } });
});

test("un campo de opción única se queda con el primer valor", () => {
  const v = normalizarValores({ modalidad: ["VERBAL", "NO_VERBAL"] }, plantilla);
  assert.deepEqual(v.modalidad, { t: "opciones", v: ["VERBAL"] });
});

test("las filas de tabla vacías se descartan y las columnas desconocidas se ignoran", () => {
  const v = normalizarValores(
    { familiares: [{ parentesco: "Padre" }, { parentesco: "  " }, {}, { inventada: "x" }, "no es fila"] },
    plantilla,
  );
  assert.deepEqual(v.familiares, { t: "tabla", filas: [{ parentesco: "Padre" }] });
});

test("no se registra lo que la condición dejó fuera", () => {
  // Con modalidad NO_VERBAL, el grupo verbal no se evaluó: aunque el formulario
  // envíe sus inputs (los oculta, no los desmonta), no deben quedar guardados.
  const v = normalizarValores(
    { modalidad: "NO_VERBAL", chk_verbal: { v1: { valor: "L" } }, chk_gen: { g1: { valor: "I" } } },
    plantilla,
  );
  assert.equal(v.chk_verbal, undefined);
  assert.deepEqual(v.chk_gen, { t: "checklist", items: { g1: { valor: "I" } } });
});

test("con la condición cumplida sí se registra", () => {
  const v = normalizarValores(
    { modalidad: "VERBAL", chk_verbal: { v1: { valor: "L" } } },
    plantilla,
  );
  assert.deepEqual(v.chk_verbal, { t: "checklist", items: { v1: { valor: "L" } } });
});

test("sin modalidad elegida todavía, el grupo condicionado se registra igual", () => {
  const v = normalizarValores({ chk_verbal: { v1: { valor: "P" } } }, plantilla);
  assert.deepEqual(v.chk_verbal, { t: "checklist", items: { v1: { valor: "P" } } });
});

/* ── Huérfanos: lo registrado con una plantilla anterior ── */

test("el valor de un campo retirado de la plantilla NO se borra", () => {
  const guardado = {
    lugar: { t: "texto", v: "Lima" },
    controlEsfinteres: { t: "texto", v: "Autónomo desde los 3 años" },
    reaccionesViejas: { t: "opciones", v: ["RECHAZO"] },
  };
  const v = normalizarValores(guardado, plantilla);
  assert.deepEqual(v.controlEsfinteres, { t: "texto", v: "Autónomo desde los 3 años" });
  assert.deepEqual(
    huerfanos(v, plantilla).map(([id]) => id).sort(),
    ["controlEsfinteres", "reaccionesViejas"],
  );
});

test("un huérfano con forma irreconocible se descarta", () => {
  const v = normalizarValores({ raro: { t: "inventado", v: 1 }, otro: 42 }, plantilla);
  assert.deepEqual(v, {});
});

test("sanear de nuevo lo ya guardado no pierde nada (ida y vuelta)", () => {
  // Los valores se sanean al guardar Y al leerlos de la base, así que la
  // segunda pasada recibe la forma etiquetada, no la del formulario. Distinguir
  // ambas formas es lo que fallaba: un checklist crudo también es un objeto.
  const delFormulario = {
    lugar: "Lima",
    convive: true,
    modalidad: "VERBAL",
    reacciones: ["RECHAZO"],
    familiares: [{ parentesco: "Padre", nombres: "Juan" }],
    chk_gen: { g1: { valor: "L", obs: "constante" } },
    chk_verbal: { v1: { valor: "P" } },
  };
  const guardado = normalizarValores(delFormulario, plantilla);
  assert.deepEqual(normalizarValores(guardado, plantilla), guardado);
  // Y sigue teniendo todo lo que se registró.
  assert.equal(Object.keys(guardado).length, 7);
});

test("una entrada que no es objeto da valores vacíos", () => {
  for (const entrada of [null, undefined, 7, "x", []]) {
    assert.deepEqual(normalizarValores(entrada, plantilla), {});
  }
});
