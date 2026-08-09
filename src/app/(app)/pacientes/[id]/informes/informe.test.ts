import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SECCIONES_DEFECTO,
  normalizarSecciones,
  resumenAvance,
  seccionesIniciales,
} from "./informe";

test("seccionesIniciales copia la plantilla sin compartir referencias", () => {
  const a = seccionesIniciales();
  a[0].items[0].label = "modificado";
  a[0].items[0].valor = "LE";

  assert.notEqual(SECCIONES_DEFECTO[0].items[0].label, "modificado");
  assert.equal(SECCIONES_DEFECTO[0].items[0].valor, undefined);
});

test("normalizarSecciones devuelve la plantilla cuando el valor es inválido", () => {
  for (const entrada of [null, undefined, {}, "texto", 42, []]) {
    const s = normalizarSecciones(entrada);
    assert.equal(s.length, SECCIONES_DEFECTO.length);
    assert.equal(s[0].id, SECCIONES_DEFECTO[0].id);
    assert.equal(s[0].items.length, SECCIONES_DEFECTO[0].items.length);
  }
});

test("normalizarSecciones conserva los textos editados del informe", () => {
  const s = normalizarSecciones([
    {
      id: "lenguaje",
      titulo: "ÁREA DE LENGUAJE",
      items: [{ id: "len_comprensivo", label: "Texto editado", valor: "EP" }],
    },
  ]);

  const lenguaje = s.find((x) => x.id === "lenguaje");
  assert.ok(lenguaje);
  assert.equal(lenguaje.items.length, 1);
  assert.equal(lenguaje.items[0].label, "Texto editado");
  assert.equal(lenguaje.items[0].valor, "EP");
});

test("normalizarSecciones completa las secciones ausentes con la plantilla", () => {
  const s = normalizarSecciones([
    { id: "lenguaje", titulo: "X", items: [{ id: "a", label: "A" }] },
  ]);

  assert.deepEqual(
    s.map((x) => x.id),
    SECCIONES_DEFECTO.map((x) => x.id),
  );
  const social = s.find((x) => x.id === "social");
  assert.equal(social?.items.length, SECCIONES_DEFECTO[3].items.length);
});

test("normalizarSecciones ignora el título guardado: las secciones no son editables", () => {
  const s = normalizarSecciones([
    { id: "social", titulo: "RENOMBRADA A MANO", items: [] },
  ]);
  assert.equal(s.find((x) => x.id === "social")?.titulo, "SOCIAL");
});

test("normalizarSecciones descarta ítems malformados y valores fuera de dominio", () => {
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

  const lenguaje = s.find((x) => x.id === "lenguaje");
  assert.deepEqual(
    lenguaje?.items.map((i) => i.id),
    ["ok", "raro"],
  );
  assert.equal(lenguaje?.items[0].valor, "LE");
  assert.equal(lenguaje?.items[1].valor, null, "valor fuera de dominio → null");
});

test("normalizarSecciones conserva secciones que ya no están en la plantilla", () => {
  const s = normalizarSecciones([
    { id: "obsoleta", titulo: "Área retirada", items: [{ id: "x", label: "X" }] },
  ]);

  const obsoleta = s.find((x) => x.id === "obsoleta");
  assert.ok(obsoleta, "no se pierden datos de informes antiguos");
  assert.equal(obsoleta.titulo, "Área retirada");
  assert.equal(s.length, SECCIONES_DEFECTO.length + 1);
});

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

test("resumenAvance con la plantilla nueva: nada calificado", () => {
  const { calificados, total } = resumenAvance(seccionesIniciales());
  assert.equal(calificados, 0);
  assert.equal(total, 28, "4 + 10 + 8 + 6 ítems del formato impreso");
});
