import { test } from "node:test";
import assert from "node:assert/strict";
import { romano, tituloGrupo, tituloSeccion } from "./numeracion";

test("romano cubre el rango que puede tener una ficha", () => {
  assert.equal(romano(1), "I");
  assert.equal(romano(4), "IV");
  assert.equal(romano(5), "V");
  assert.equal(romano(9), "IX");
  assert.equal(romano(10), "X");
  assert.equal(romano(14), "XIV");
  assert.equal(romano(30), "XXX");
});

test("romano devuelve el número tal cual si está fuera de rango", () => {
  assert.equal(romano(0), "0");
  assert.equal(romano(-3), "-3");
  assert.equal(romano(1.5), "1.5");
});

test("las secciones se numeran por posición, no por texto guardado", () => {
  assert.equal(tituloSeccion("Datos generales", 0, true), "I. Datos generales");
  assert.equal(tituloSeccion("Historia personal", 2, true), "III. Historia personal");
  // Al desactivar la numeración el título queda pelado.
  assert.equal(tituloSeccion("Datos generales", 0, false), "Datos generales");
  assert.equal(tituloSeccion("Datos generales", 0, undefined), "Datos generales");
});

test("los grupos se numeran dentro de su sección (II.1, II.2)", () => {
  assert.equal(tituloGrupo("Historia familiar", 1, 0, true, true), "II.1 Historia familiar");
  assert.equal(tituloGrupo("Historia pre - postnatal", 1, 1, true, true), "II.2 Historia pre - postnatal");
  // Sin numeración de secciones, el grupo se numera solo.
  assert.equal(tituloGrupo("Historia familiar", 1, 0, false, true), "1. Historia familiar");
  // Sin numeración de grupos, el subtítulo queda intacto.
  assert.equal(tituloGrupo("Fijación de mirada", 4, 0, true, false), "Fijación de mirada");
});
