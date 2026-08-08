import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS_FICHA, gruposVisibles, normalizarResultados } from "./ficha";

const LENGUAJE = AREAS_FICHA.find((a) => a.id === "lenguaje")!;
const CONDUCTUAL = AREAS_FICHA.find((a) => a.id === "conductual")!;

test("gruposVisibles filtra el área de lenguaje según la modalidad", () => {
  assert.deepEqual(
    gruposVisibles(LENGUAJE, "NO_VERBAL").map((g) => g.titulo),
    ["No verbal"],
  );
  assert.deepEqual(
    gruposVisibles(LENGUAJE, "VERBAL").map((g) => g.titulo),
    ["Verbal"],
  );
});

test("gruposVisibles muestra todo si no hay modalidad o el área no la usa", () => {
  assert.deepEqual(gruposVisibles(LENGUAJE, null), LENGUAJE.grupos);
  assert.deepEqual(gruposVisibles(LENGUAJE, ""), LENGUAJE.grupos);
  assert.deepEqual(gruposVisibles(CONDUCTUAL, "VERBAL"), CONDUCTUAL.grupos);
});

test("el catálogo de la ficha no tiene ids de ítem duplicados", () => {
  const ids = AREAS_FICHA.flatMap((a) =>
    a.grupos.flatMap((g) => g.items.map((i) => i.id)),
  );
  assert.equal(new Set(ids).size, ids.length);
});

test("normalizarResultados conserva valores válidos y observaciones", () => {
  const res = normalizarResultados({
    cond_contacto_visual: { valor: "P", obs: "  se distrae  " },
    leng_ecolalia: { valor: "SI" },
  });
  assert.deepEqual(res, {
    cond_contacto_visual: { valor: "P", obs: "se distrae" },
    leng_ecolalia: { valor: "SI" },
  });
});

test("normalizarResultados descarta ids desconocidos, valores fuera de dominio y vacíos", () => {
  const res = normalizarResultados({
    inventado: { valor: "SI" }, // id que no está en el catálogo
    cond_senala: { valor: "SI" }, // área IPL: "SI" no es un valor válido
    leng_imitacion: { valor: "X" }, // fuera de dominio
    cog_numeros: { valor: undefined, obs: "   " }, // entrada vacía
  });
  assert.deepEqual(res, {});
});

test("normalizarResultados tolera entradas que no son objetos", () => {
  assert.deepEqual(normalizarResultados(null), {});
  assert.deepEqual(normalizarResultados("basura"), {});
  assert.deepEqual(normalizarResultados([1, 2]), {});
});
