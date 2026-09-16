import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarPlantilla } from "@/lib/fichas/plantilla";
import { PSICOLOGICA } from "@/lib/fichas/base/psicologica";
import {
  normalizarSecciones,
  resumenAvance,
  seccionesDePlantilla,
  seccionesSinValores,
  totalItemsDePlantilla,
} from "./informe";

/* ── Semilla desde la plantilla del centro ─────────────── */

test("seccionesDePlantilla convierte los checklists en secciones del informe", () => {
  const s = seccionesDePlantilla(PSICOLOGICA.INFORME);

  assert.deepEqual(
    s.map((x) => x.id),
    ["lenguaje", "pedagogica", "autonomia", "social"],
  );
  assert.equal(s[0].titulo, "ÁREA DE LENGUAJE");
  assert.equal(s[0].items[0].id, "len_comprensivo");
  // Nace sin calificar.
  assert.ok(s.every((sec) => sec.items.every((i) => i.valor === null)));
  assert.equal(
    s.reduce((n, sec) => n + sec.items.length, 0),
    28,
    "4 + 10 + 8 + 6 ítems del formato impreso",
  );
});

test("una sección de la plantilla sin checklists no entra al informe", () => {
  const p = normalizarPlantilla({
    escalas: [{ id: "EIEPLE", valores: ["EI", "EP", "LE"], labels: {} }],
    secciones: [
      {
        id: "solo_texto",
        titulo: "Notas",
        grupos: [{ id: "g", campos: [{ tipo: "parrafo", id: "n", label: "Nota" }] }],
      },
      {
        id: "con_items",
        titulo: "Área",
        escalaId: "EIEPLE",
        grupos: [
          { id: "g", campos: [{ tipo: "checklist", id: "c", items: [{ id: "i1", label: "Uno" }] }] },
        ],
      },
    ],
  });

  assert.deepEqual(seccionesDePlantilla(p).map((s) => s.id), ["con_items"]);
});

test("totalItemsDePlantilla cuenta los ítems calificables", () => {
  assert.equal(totalItemsDePlantilla(PSICOLOGICA.INFORME), 28);
});

/* ── Saneado del Json guardado ─────────────────────────── */

test("normalizarSecciones devuelve vacío cuando el valor no es una lista", () => {
  for (const entrada of [null, undefined, {}, "texto", 42]) {
    assert.deepEqual(normalizarSecciones(entrada), []);
  }
});

test("el informe es la fuente de verdad de su estructura", () => {
  // Antes se reponían las secciones faltantes desde un catálogo fijo. Ahora no:
  // cada centro tiene su plantilla, y rellenar un informe antiguo con la
  // plantilla vigente cambiaría lo que el profesional firmó.
  const s = normalizarSecciones([
    {
      id: "lenguaje",
      titulo: "ÁREA DE LENGUAJE",
      items: [{ id: "len_comprensivo", label: "Texto editado", valor: "EP" }],
    },
  ]);

  assert.equal(s.length, 1, "no se agregan secciones que el informe no tenía");
  assert.equal(s[0].items.length, 1);
  assert.equal(s[0].items[0].label, "Texto editado");
  assert.equal(s[0].items[0].valor, "EP");
});

test("se respeta el título guardado en el informe", () => {
  const s = normalizarSecciones([{ id: "social", titulo: "ÁREA SOCIAL", items: [] }]);
  assert.equal(s[0].titulo, "ÁREA SOCIAL");
});

test("una sección sin título usable cae en su id", () => {
  const s = normalizarSecciones([{ id: "social", titulo: "   ", items: [] }]);
  assert.equal(s[0].titulo, "social");
});

test("descarta ítems malformados y valores fuera de dominio", () => {
  const s = normalizarSecciones([
    {
      id: "lenguaje",
      titulo: "ÁREA DE LENGUAJE",
      items: [
        { id: "ok", label: "Válido", valor: "LE" },
        { id: "raro", label: "Valor inválido", valor: "ZZ" },
        { id: "vacio", label: "   " },
        { id: "sin_label" },
        { label: "sin id" },
        null,
        "texto",
      ],
    },
  ]);

  assert.deepEqual(s[0].items.map((i) => i.id), ["ok", "raro"]);
  assert.equal(s[0].items[0].valor, "LE");
  assert.equal(s[0].items[1].valor, null, "valor fuera de dominio → null");
});

test("descarta secciones sin id", () => {
  const s = normalizarSecciones([{ titulo: "Sin id", items: [] }, null, "x"]);
  assert.deepEqual(s, []);
});

// Regresión: `nuevo_${useId()}_${contador}` con el contador reiniciado en cada
// montaje podía repetir el id de un ítem ad-hoc ya guardado. Dos ítems con el
// mismo id se colapsan en compararInformes (empareja con un Map por id) y uno
// pierde su historial. El formulario ya no los genera repetidos, y aquí se
// desambigua lo que hubiera quedado guardado.
test("dos ítems con el mismo id dentro de una sección se desambiguan", () => {
  const s = normalizarSecciones([
    {
      id: "lenguaje",
      titulo: "L",
      items: [
        { id: "nuevo_r3_0", label: "Praxias linguales", valor: "EI" },
        { id: "nuevo_r3_0", label: "Soplo sostenido", valor: "LE" },
      ],
    },
  ]);

  assert.deepEqual(s[0].items.map((i) => i.id), ["nuevo_r3_0", "nuevo_r3_0_dup"]);
  assert.deepEqual(s[0].items.map((i) => i.label), ["Praxias linguales", "Soplo sostenido"]);
  assert.equal(s[0].items.length, 2, "ninguno se pierde");
});

/* ── Resumen y precarga ────────────────────────────────── */

test("resumenAvance cuenta solo los ítems calificados", () => {
  const secciones = [
    {
      id: "a",
      titulo: "A",
      items: [
        { id: "1", label: "x", valor: "EI" as const },
        { id: "2", label: "y", valor: null },
        { id: "3", label: "z" },
      ],
    },
    { id: "b", titulo: "B", items: [{ id: "4", label: "w", valor: "LE" as const }] },
  ];

  assert.deepEqual(resumenAvance(secciones), { calificados: 2, total: 4 });
});

test("un informe recién sembrado no tiene nada calificado", () => {
  const { calificados, total } = resumenAvance(seccionesDePlantilla(PSICOLOGICA.INFORME));
  assert.equal(calificados, 0);
  assert.equal(total, 28);
});

test("seccionesSinValores conserva ítems y textos, y borra las calificaciones", () => {
  const anterior = [
    {
      id: "lenguaje",
      titulo: "ÁREA DE LENGUAJE",
      items: [
        { id: "len_comprensivo", label: "Texto editado", valor: "LE" as const },
        { id: "nuevo_abc_0", label: "Agregado a mano", valor: "EP" as const },
      ],
    },
  ];

  const s = seccionesSinValores(anterior);

  assert.deepEqual(
    s[0].items.map((i) => [i.id, i.label, i.valor]),
    [
      ["len_comprensivo", "Texto editado", null],
      ["nuevo_abc_0", "Agregado a mano", null],
    ],
  );
  // No comparte referencias con el informe de origen.
  assert.equal(anterior[0].items[0].valor, "LE");
});
