import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generarIntervalos,
  esIntervaloValido,
  opcionesPaso,
  PASO_GRILLA_MIN,
} from "./horario";

// Escenario del cliente: terapias grupales de 90 min y una individual de
// 9:00–9:45. Antes, la grilla avanzaba de duración en duración (90 min:
// 9:00, 10:30, …), así que era imposible iniciar la grupal a las 9:45.
// Ahora el paso de la grilla es independiente de la duración de la sesión.

test("grilla de 15 min ofrece 9:45 como inicio para una sesión de 90 min", () => {
  const filas = generarIntervalos("09:00", "13:00", 90, 15);
  const inicios = filas.map((i) => i.inicio);
  assert.ok(inicios.includes("09:45"));
  // La fila 9:45 representa la sesión completa 9:45–11:15 (para pintar
  // ocupación se compara contra todo el rango, no solo la celda).
  const f = filas.find((i) => i.inicio === "09:45")!;
  assert.equal(f.fin, "11:15");
  // Ningún inicio deja a la sesión terminando después del cierre.
  assert.ok(filas.every((i) => i.fin <= "13:00"));
  assert.equal(inicios.at(-1), "11:30"); // último inicio que cabe: 11:30–13:00
});

test("sin paso explícito conserva el comportamiento anterior (paso = duración)", () => {
  const inicios = generarIntervalos("09:00", "13:00", 90).map((i) => i.inicio);
  assert.deepEqual(inicios, ["09:00", "10:30"]);
});

test("esIntervaloValido acepta inicios alineados al paso y que quepan", () => {
  // El servidor valida contra el paso más fino configurable (5 min).
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "09:45", PASO_GRILLA_MIN), true);
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "11:30", PASO_GRILLA_MIN), true);
  // 9:50 ahora es válido: está alineado a 5 min desde las 9:00.
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "09:50", PASO_GRILLA_MIN), true);
  // Desalineado del paso (9:52 no es múltiplo de 5 desde las 9:00).
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "09:52", PASO_GRILLA_MIN), false);
  // No cabe: 11:45 + 90 min = 13:15 > cierre.
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "11:45", PASO_GRILLA_MIN), false);
  // Antes de la apertura.
  assert.equal(esIntervaloValido("09:00", "13:00", 90, "08:45", PASO_GRILLA_MIN), false);
});

// Escenario del cliente: agregó 40 min a la lista de intervalos de la sede y
// esperaba verlo en el dropdown "Intervalo" de /sesiones/nuevo.
test("opcionesPaso incluye los intervalos configurados por la sede (ej. 40)", () => {
  assert.deepEqual(opcionesPaso([15, 30, 40, 45, 60], 45), [15, 30, 40, 45, 60]);
});

test("opcionesPaso usa los pasos predefinidos si la sede no configuró lista", () => {
  assert.deepEqual(opcionesPaso([], 30), [15, 30, 45, 60]);
});

test("opcionesPaso agrega el intervalo inicial si falta en la lista, ordenado", () => {
  assert.deepEqual(opcionesPaso([60, 15], 45), [15, 45, 60]);
});
