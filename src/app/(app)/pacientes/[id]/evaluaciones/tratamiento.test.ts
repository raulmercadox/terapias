import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTratamiento, sesionesSemanaSugeridas } from "./tratamiento";

test("sugiere sesiones por semana repartiendo en el plazo", () => {
  assert.equal(sesionesSemanaSugeridas(8, 4), 2);
  assert.equal(sesionesSemanaSugeridas(10, 4), 3);
  assert.equal(sesionesSemanaSugeridas(2, 4), 1);
  assert.equal(sesionesSemanaSugeridas(0, 4), 1);
});

test("tratamiento vacío es válido y usa el plazo por defecto", () => {
  assert.deepEqual(parseTratamiento("", ""), { plazoSemanas: 4, lineas: [] });
  assert.deepEqual(parseTratamiento(null, "[]"), { plazoSemanas: 4, lineas: [] });
});

test("lee las líneas del tratamiento", () => {
  const r = parseTratamiento(
    "4",
    JSON.stringify([
      { terapiaId: "len", sesiones: "8", sesionesSemana: 2 },
      { terapiaId: "to", sesiones: 4, sesionesSemana: "1" },
    ]),
  );
  assert.deepEqual(r, {
    plazoSemanas: 4,
    lineas: [
      { terapiaId: "len", sesiones: 8, sesionesSemana: 2 },
      { terapiaId: "to", sesiones: 4, sesionesSemana: 1 },
    ],
  });
});

test("rechaza datos inválidos", () => {
  const err = (p: unknown, l: unknown) => "error" in parseTratamiento(p, l);
  assert.ok(err("0", "[]"));
  assert.ok(err("4", "{no es json"));
  assert.ok(err("4", JSON.stringify([{ terapiaId: "", sesiones: 8, sesionesSemana: 2 }])));
  assert.ok(err("4", JSON.stringify([{ terapiaId: "a", sesiones: 0, sesionesSemana: 1 }])));
  assert.ok(err("4", JSON.stringify([{ terapiaId: "a", sesiones: 2, sesionesSemana: 3 }])));
  assert.ok(
    err(
      "4",
      JSON.stringify([
        { terapiaId: "a", sesiones: 8, sesionesSemana: 2 },
        { terapiaId: "a", sesiones: 4, sesionesSemana: 1 },
      ]),
    ),
  );
});
