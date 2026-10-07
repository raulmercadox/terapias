import { test } from "node:test";
import assert from "node:assert/strict";
import { plantillaSemanal, proyectarHorario } from "./renovacion";

// Lunes 5 de octubre de 2026.
const LUNES = new Date(2026, 9, 5);
const todo = () => true;

test("proyecta lunes y jueves hasta completar el total", () => {
  const sel = proyectarHorario({
    plantilla: [
      { dia: 4, hora: "10:00" },
      { dia: 1, hora: "09:00" },
    ],
    total: 4,
    desde: LUNES,
    semanas: 60,
    seleccionable: todo,
  });
  assert.deepEqual(sel, {
    "2026-10-05": "09:00",
    "2026-10-08": "10:00",
    "2026-10-12": "09:00",
    "2026-10-15": "10:00",
  });
});

test("arranca desde la fecha indicada aunque sea a mitad de semana", () => {
  const sel = proyectarHorario({
    plantilla: [
      { dia: 1, hora: "09:00" },
      { dia: 4, hora: "10:00" },
    ],
    total: 2,
    desde: new Date(2026, 9, 7), // miércoles
    semanas: 60,
    seleccionable: todo,
  });
  assert.deepEqual(Object.keys(sel), ["2026-10-08", "2026-10-12"]);
});

test("salta las franjas no disponibles y sigue en semanas siguientes", () => {
  const ocupadas = new Set(["2026-10-12", "2026-10-19"]);
  const sel = proyectarHorario({
    plantilla: [{ dia: 1, hora: "09:00" }],
    total: 3,
    desde: LUNES,
    semanas: 60,
    seleccionable: (clave) => !ocupadas.has(clave),
  });
  assert.deepEqual(Object.keys(sel), ["2026-10-05", "2026-10-26", "2026-11-02"]);
});

test("devuelve menos que el total si no hay espacio en el horizonte", () => {
  const sel = proyectarHorario({
    plantilla: [{ dia: 1, hora: "09:00" }],
    total: 10,
    desde: LUNES,
    semanas: 2,
    seleccionable: todo,
  });
  assert.equal(Object.keys(sel).length, 3);
});

test("sin plantilla o sin total no marca nada", () => {
  assert.deepEqual(
    proyectarHorario({ plantilla: [], total: 4, desde: LUNES, semanas: 60, seleccionable: todo }),
    {},
  );
  assert.deepEqual(
    proyectarHorario({
      plantilla: [{ dia: 1, hora: "09:00" }],
      total: 0,
      desde: LUNES,
      semanas: 60,
      seleccionable: todo,
    }),
    {},
  );
});

test("plantillaSemanal toma el primer horario de cada día", () => {
  assert.deepEqual(
    plantillaSemanal([
      { fecha: new Date(2026, 8, 7), horaInicio: "09:00" }, // lunes
      { fecha: new Date(2026, 8, 10), horaInicio: "11:00" }, // jueves
      { fecha: new Date(2026, 8, 14), horaInicio: "15:00" }, // lunes
    ]),
    [
      { dia: 1, hora: "09:00" },
      { dia: 4, hora: "11:00" },
    ],
  );
});
