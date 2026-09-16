import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diasEntreISO,
  estadoVencimiento,
  textoVencimiento,
  paquetesRenovados,
  sumarDiasISO,
} from "./vencimiento";

const HOY = "2026-09-13";
const estado = (finReal: string | null, restantes = 3) =>
  estadoVencimiento({ finReal, restantes, hoy: HOY });

test("por vencer si la última sesión es dentro de los próximos 7 días", () => {
  assert.equal(estado("2026-09-13"), "por-vencer"); // hoy
  assert.equal(estado("2026-09-20"), "por-vencer"); // hoy + 7
  assert.equal(estado("2026-09-21"), null); // hoy + 8
});

test("terminado si la última sesión ya pasó o no quedan sesiones", () => {
  assert.equal(estado("2026-09-12"), "terminado");
  assert.equal(estado("2026-10-30", 0), "terminado");
  assert.equal(estado(null, 0), "terminado");
});

test("sin fecha de fin y con sesiones restantes no avisa", () => {
  assert.equal(estado(null), null);
});

test("sumarDiasISO cruza meses y años", () => {
  assert.equal(sumarDiasISO("2026-09-28", 7), "2026-10-05");
  assert.equal(sumarDiasISO("2026-12-30", 7), "2027-01-06");
});

test("diasEntreISO cuenta hacia adelante y hacia atrás", () => {
  assert.equal(diasEntreISO("2026-09-13", "2026-09-20"), 7);
  assert.equal(diasEntreISO("2026-09-20", "2026-09-13"), -7);
  assert.equal(diasEntreISO("2026-12-30", "2027-01-06"), 7);
});

test("textos del aviso", () => {
  assert.equal(textoVencimiento("terminado", "2026-09-10", HOY), "Terminó 10/09");
  assert.equal(textoVencimiento("terminado", null, HOY), "Terminó");
  assert.equal(textoVencimiento("por-vencer", "2026-09-13", HOY), "Termina hoy");
  assert.equal(textoVencimiento("por-vencer", "2026-09-14", HOY), "Termina mañana");
  assert.equal(
    textoVencimiento("por-vencer", "2026-09-16", HOY),
    "Termina 16/09 · en 3 días",
  );
});

test("un paquete renovado por otro más nuevo del mismo paciente no avisa", () => {
  const renovados = paquetesRenovados([
    { id: "viejo", pacienteId: "ana", createdAt: new Date("2026-08-01") },
    { id: "nuevo", pacienteId: "ana", createdAt: new Date("2026-09-10") },
    { id: "luis", pacienteId: "luis", createdAt: new Date("2026-07-01") },
  ]);
  assert.deepEqual([...renovados], ["viejo"]);
});
