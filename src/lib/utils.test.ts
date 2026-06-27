import { test } from "node:test";
import assert from "node:assert/strict";
import { fecha, fechaInput } from "./utils";

// Regresión del bug de reprogramar sesiones:
//
// El servidor de producción corre en America/New_York (UTC-4/-5). Cuando se
// reprograma una sesión al, por ejemplo, 15/07/2026, el server la almacena a su
// medianoche local: la instancia UTC resultante es 2026-07-15T04:00:00Z (EDT) o
// 2026-07-15T05:00:00Z (EST). El día UTC de esa instancia es el 15.
//
// El bug: la fila de sesión es un client component y formateaba esa instancia en
// la zona del navegador (Lima, UTC-5), donde 2026-07-15T04:00:00Z cae el día 14
// a las 23:00 -> mostraba "14/07/2026" y el <input type=date> precargaba
// "2026-07-14". La hora ("HH:mm") es un string y por eso sí se conservaba.
//
// El fix: `fecha` y `fechaInput` interpretan los campos solo-fecha SIEMPRE en
// UTC, de modo que el día mostrado coincide con el elegido en cualquier zona.

const MEDIANOCHE_NY_VERANO = "2026-07-15T04:00:00.000Z"; // EDT (UTC-4)
const MEDIANOCHE_NY_INVIERNO = "2026-01-20T05:00:00.000Z"; // EST (UTC-5)
const MEDIANOCHE_UTC = "2026-07-15T00:00:00.000Z";

test("fecha() muestra la fecha elegida y no retrocede un día", () => {
  assert.equal(fecha(MEDIANOCHE_NY_VERANO), "15/07/2026");
  assert.equal(fecha(MEDIANOCHE_NY_INVIERNO), "20/01/2026");
  assert.equal(fecha(MEDIANOCHE_UTC), "15/07/2026");
  assert.equal(fecha(new Date(MEDIANOCHE_NY_VERANO)), "15/07/2026");
});

test("fechaInput() precarga el <input type=date> con la fecha elegida", () => {
  assert.equal(fechaInput(MEDIANOCHE_NY_VERANO), "2026-07-15");
  assert.equal(fechaInput(MEDIANOCHE_NY_INVIERNO), "2026-01-20");
  assert.equal(fechaInput(MEDIANOCHE_UTC), "2026-07-15");
});

test("round-trip reprogramar: lo guardado por el server (NY) se muestra igual", () => {
  // El usuario elige esta fecha en el <input type=date>.
  const elegido = "2026-07-15";

  // El server (America/New_York) la ancla a su medianoche -> instancia UTC.
  const [y, m, d] = elegido.split("-").map(Number);
  const guardado = anclarMedianocheEnNY(y, m, d);

  // Lo que ve/precarga el navegador (Perú) debe coincidir con lo elegido.
  assert.equal(fechaInput(guardado.toISOString()), elegido);
  assert.equal(fecha(guardado.toISOString()), "15/07/2026");
});

test("fecha()/fechaInput() manejan valores nulos o inválidos", () => {
  assert.equal(fecha(null), "—");
  assert.equal(fecha("no-es-fecha"), "—");
  assert.equal(fechaInput(null), "");
  assert.equal(fechaInput(undefined), "");
  assert.equal(fechaInput("no-es-fecha"), "");
});

/** Medianoche del día (y,m,d) en America/New_York, como instancia UTC. */
function anclarMedianocheEnNY(y: number, m: number, d: number): Date {
  // Offset de NY ese día (240 min en verano/EDT, 300 en invierno/EST).
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  });
  const tentativo = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const parte = fmt
    .formatToParts(tentativo)
    .find((p) => p.type === "timeZoneName")?.value; // p.ej. "GMT-4"
  const horas = Number(parte?.replace("GMT", "") ?? "-4");
  // Medianoche local = 00:00 - offset (offset negativo => sumamos horas UTC).
  return new Date(Date.UTC(y, m - 1, d, -horas, 0, 0));
}
