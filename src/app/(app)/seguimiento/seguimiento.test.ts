import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pendienteDe,
  aInputLima,
  parseInputLima,
  diasDesde,
  type InteraccionBase,
} from "./seguimiento";

const entrada = (iso: string): InteraccionBase => ({
  direccion: "ENTRADA",
  resultado: null,
  fecha: new Date(iso),
});
const contacto = (iso: string): InteraccionBase => ({
  direccion: "SALIDA",
  resultado: "CONTACTADO",
  fecha: new Date(iso),
});
const sinRespuesta = (iso: string): InteraccionBase => ({
  direccion: "SALIDA",
  resultado: "SIN_RESPUESTA",
  fecha: new Date(iso),
});

test("sin interacciones no hay nada pendiente", () => {
  assert.equal(pendienteDe([]), null);
});

test("una entrada sin salida queda pendiente desde su fecha", () => {
  const p = pendienteDe([entrada("2026-09-01T15:00:00Z")]);
  assert.deepEqual(p, {
    desde: new Date("2026-09-01T15:00:00Z"),
    entradas: 1,
    intentos: 0,
    ultimoIntento: null,
  });
});

test("una salida contactado posterior cierra la entrada", () => {
  assert.equal(
    pendienteDe([
      entrada("2026-09-01T15:00:00Z"),
      contacto("2026-09-02T15:00:00Z"),
    ]),
    null,
  );
});

test("una salida sin respuesta no cierra: cuenta como intento", () => {
  const p = pendienteDe([
    entrada("2026-09-01T15:00:00Z"),
    sinRespuesta("2026-09-02T15:00:00Z"),
    sinRespuesta("2026-09-03T15:00:00Z"),
  ]);
  assert.equal(p?.intentos, 2);
  assert.deepEqual(p?.ultimoIntento, new Date("2026-09-03T15:00:00Z"));
  assert.deepEqual(p?.desde, new Date("2026-09-01T15:00:00Z"));
});

test("una entrada nueva tras un contacto vuelve a quedar pendiente", () => {
  const p = pendienteDe([
    entrada("2026-08-01T15:00:00Z"),
    contacto("2026-08-02T15:00:00Z"),
    entrada("2026-09-05T15:00:00Z"),
  ]);
  assert.deepEqual(p?.desde, new Date("2026-09-05T15:00:00Z"));
  assert.equal(p?.entradas, 1);
});

test("los intentos previos a la entrada pendiente no se cuentan", () => {
  const p = pendienteDe([
    contacto("2026-08-02T15:00:00Z"),
    sinRespuesta("2026-08-10T15:00:00Z"),
    entrada("2026-09-05T15:00:00Z"),
  ]);
  assert.equal(p?.intentos, 0);
});

test("varias entradas sin respuesta: pendiente desde la más antigua", () => {
  const p = pendienteDe([
    entrada("2026-09-05T15:00:00Z"),
    entrada("2026-09-01T15:00:00Z"),
  ]);
  assert.deepEqual(p?.desde, new Date("2026-09-01T15:00:00Z"));
  assert.equal(p?.entradas, 2);
});

test("un contacto a la misma hora que la entrada la atiende", () => {
  assert.equal(
    pendienteDe([
      entrada("2026-09-01T15:00:00Z"),
      contacto("2026-09-01T15:00:00Z"),
    ]),
    null,
  );
});

test("datetime-local se interpreta y se precarga en hora de Lima", () => {
  // 21:30 en Lima = 02:30 UTC del día siguiente.
  const d = parseInputLima("2026-09-10T21:30");
  assert.equal(d?.toISOString(), "2026-09-11T02:30:00.000Z");
  assert.equal(aInputLima(new Date("2026-09-11T02:30:00Z")), "2026-09-10T21:30");
  assert.equal(parseInputLima("2026-09-10"), null);
  assert.equal(parseInputLima(""), null);
});

test("diasDesde cuenta días calendario de Lima, no bloques de 24 h", () => {
  // 23:00 del 9 y 08:00 del 10 en Lima: un día de diferencia, aunque son 9 h.
  const anoche = new Date("2026-09-10T04:00:00Z");
  const manana = new Date("2026-09-10T13:00:00Z");
  assert.equal(diasDesde(anoche, manana), 1);
  assert.equal(diasDesde(manana, manana), 0);
});
