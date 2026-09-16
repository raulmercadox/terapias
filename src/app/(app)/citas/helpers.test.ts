import { test } from "node:test";
import assert from "node:assert/strict";
import { consolidarDia, type Jornada } from "./helpers";

const MANANA: Jornada = { apertura: "09:00", cierre: "13:00", refrigerio: null };

const cita = (horaInicio: string, horaFin: string) => ({ horaInicio, horaFin });
const resumen = (bloques: ReturnType<typeof consolidarDia>) =>
  bloques.map((b) => `${b.tipo} ${b.inicio}-${b.fin}`);

// Caso del cliente: el martes el terapeuta tiene cuatro citas seguidas; en la
// vista consolidada deben verse como un solo bloque ocupado 9:00–12:45.
test("citas contiguas forman un solo bloque ocupado y el resto es libre", () => {
  const bloques = consolidarDia(
    [
      cita("09:00", "09:45"),
      cita("09:45", "10:30"),
      cita("10:30", "12:00"),
      cita("12:00", "12:45"),
    ],
    MANANA,
  );
  assert.deepEqual(resumen(bloques), ["ocupado 09:00-12:45", "libre 12:45-13:00"]);
  assert.equal(bloques[0].citas, 4);
});

test("el orden de entrada no importa y las grupales solapadas se fusionan", () => {
  const bloques = consolidarDia(
    [cita("10:00", "11:30"), cita("09:00", "09:45"), cita("10:00", "11:30")],
    MANANA,
  );
  assert.deepEqual(resumen(bloques), [
    "ocupado 09:00-09:45",
    "libre 09:45-10:00",
    "ocupado 10:00-11:30",
    "libre 11:30-13:00",
  ]);
  assert.equal(bloques[2].citas, 2);
});

test("día sin citas: toda la jornada libre", () => {
  assert.deepEqual(resumen(consolidarDia([], MANANA)), ["libre 09:00-13:00"]);
});

test("el refrigerio no cuenta como libre, salvo lo que ocupe una cita", () => {
  const jornada: Jornada = {
    apertura: "09:00",
    cierre: "18:00",
    refrigerio: { inicio: "13:00", fin: "14:00" },
  };
  assert.deepEqual(resumen(consolidarDia([cita("12:00", "13:00")], jornada)), [
    "libre 09:00-12:00",
    "ocupado 12:00-13:00",
    "refrigerio 13:00-14:00",
    "libre 14:00-18:00",
  ]);
  // Una cita que invade el refrigerio se ve ocupada en esa parte.
  assert.deepEqual(resumen(consolidarDia([cita("12:30", "13:15")], jornada)), [
    "libre 09:00-12:30",
    "ocupado 12:30-13:15",
    "refrigerio 13:15-14:00",
    "libre 14:00-18:00",
  ]);
});

test("citas fuera de horario y días no laborables solo muestran lo ocupado", () => {
  assert.deepEqual(resumen(consolidarDia([cita("13:00", "13:45")], MANANA)), [
    "libre 09:00-13:00",
    "ocupado 13:00-13:45",
  ]);
  assert.deepEqual(resumen(consolidarDia([cita("10:00", "10:45")], null)), [
    "ocupado 10:00-10:45",
  ]);
  assert.deepEqual(consolidarDia([], null), []);
});

test("ignora citas con horas inválidas", () => {
  assert.deepEqual(
    resumen(consolidarDia([cita("10:00", "09:00"), cita("xx", "10:00")], MANANA)),
    ["libre 09:00-13:00"],
  );
});
