import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarFamiliares } from "./historia";

test("normalizarFamiliares conserva filas válidas y recorta los textos", () => {
  const res = normalizarFamiliares([
    { parentesco: "Padre", nombres: "  Juan Pérez ", edad: "42", ocupacion: "Chofer" },
    { parentesco: "Madre", relacion: "Buena, es quien lo cuida" },
  ]);
  assert.deepEqual(res, [
    { parentesco: "Padre", nombres: "Juan Pérez", edad: "42", ocupacion: "Chofer" },
    { parentesco: "Madre", relacion: "Buena, es quien lo cuida" },
  ]);
});

test("normalizarFamiliares descarta filas vacías, campos desconocidos y no-strings", () => {
  const res = normalizarFamiliares([
    { parentesco: "  ", nombres: "" }, // fila vacía tras recortar
    { hackeo: "x", edad: 42 }, // campo desconocido y edad no-string
    { parentesco: "Hermano", extra: "se ignora" },
  ]);
  assert.deepEqual(res, [{ parentesco: "Hermano" }]);
});

test("normalizarFamiliares tolera entradas que no son arrays", () => {
  assert.deepEqual(normalizarFamiliares(null), []);
  assert.deepEqual(normalizarFamiliares("basura"), []);
  assert.deepEqual(normalizarFamiliares({ parentesco: "Padre" }), []);
  assert.deepEqual(normalizarFamiliares([null, "x", [1]]), []);
});
