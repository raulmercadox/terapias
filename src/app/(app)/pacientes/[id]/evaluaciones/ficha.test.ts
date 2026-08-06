import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS_FICHA, normalizarResultados } from "./ficha";

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
