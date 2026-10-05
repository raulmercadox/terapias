import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluarCupo, estadoCelda, type CitaOcupada } from "./disponibilidad";

const LENGUAJE = { id: "len", modalidad: "INDIVIDUAL" as const, maxParticipantes: 1 };
const SOCIAL = { id: "soc", modalidad: "GRUPAL" as const, maxParticipantes: 3 };

const franja = { horaInicio: "10:00", horaFin: "10:45" };
const cita = (pacienteId: string, terapiaId: string | null, hi = "10:00", hf = "10:45") => ({
  pacienteId,
  terapiaId,
  horaInicio: hi,
  horaFin: hf,
});

test("franja sin citas está libre", () => {
  assert.equal(evaluarCupo([], franja, LENGUAJE, "p1").estado, "libre");
});

test("individual: cualquier cruce ocupa la franja", () => {
  const r = evaluarCupo([cita("p2", "len")], franja, LENGUAJE, "p1");
  assert.equal(r.estado, "ocupado");
  // Solo roza el final: no se cruza.
  assert.equal(
    evaluarCupo([cita("p2", "len", "09:15", "10:00")], franja, LENGUAJE, "p1").estado,
    "libre",
  );
});

test("grupal: comparte con la misma terapia y horario hasta el máximo", () => {
  assert.equal(evaluarCupo([cita("p2", "soc")], franja, SOCIAL, "p1").estado, "parcial");
  assert.equal(
    evaluarCupo([cita("p2", "soc"), cita("p3", "soc")], franja, SOCIAL, "p1").estado,
    "parcial",
  );
  assert.equal(
    evaluarCupo(
      [cita("p2", "soc"), cita("p3", "soc"), cita("p4", "soc")],
      franja,
      SOCIAL,
      "p1",
    ).estado,
    "lleno",
  );
});

test("grupal: no se comparte con otra terapia, otro horario o citas sin terapia", () => {
  assert.equal(evaluarCupo([cita("p2", "mot")], franja, SOCIAL, "p1").estado, "ocupado"); // otra terapia grupal
  assert.equal(
    evaluarCupo([cita("p2", "soc", "10:15", "11:00")], franja, SOCIAL, "p1").estado,
    "ocupado",
  );
  assert.equal(evaluarCupo([cita("p2", null)], franja, SOCIAL, "p1").estado, "ocupado");
});

test("las citas del mismo paciente no cuentan para el cupo del terapeuta", () => {
  assert.equal(evaluarCupo([cita("p1", "len")], franja, LENGUAJE, "p1").estado, "libre");
});

test("sin terapia (cita suelta) la franja es exclusiva", () => {
  assert.equal(evaluarCupo([cita("p2", "soc")], franja, null, "p1").estado, "ocupado");
});

test("estadoCelda respeta el orden de prioridad", () => {
  const base = {
    clave: "2026-10-12",
    ...franja,
    hoyClave: "2026-10-05",
    feriados: new Set<string>(),
    vacaciones: [],
    citasTerapeuta: [] as CitaOcupada[],
    citasPaciente: [] as CitaOcupada[],
    terapia: SOCIAL,
    pacienteId: "p1",
  };
  assert.equal(estadoCelda(base), "libre");
  assert.equal(estadoCelda({ ...base, hoyClave: "2026-10-13" }), "pasado");
  assert.equal(estadoCelda({ ...base, feriados: new Set(["2026-10-12"]) }), "feriado");
  assert.equal(
    estadoCelda({ ...base, vacaciones: [{ inicio: "2026-10-10", fin: "2026-10-12" }] }),
    "vacaciones",
  );
  assert.equal(
    estadoCelda({
      ...base,
      citasPaciente: [{ ...cita("p1", "len", "10:30", "11:15"), clave: "2026-10-12" }],
    }),
    "pacienteOcupado",
  );
  // Cita del terapeuta en otro día: no afecta.
  assert.equal(
    estadoCelda({
      ...base,
      citasTerapeuta: [{ ...cita("p2", "len"), clave: "2026-10-13" }],
    }),
    "libre",
  );
  assert.equal(
    estadoCelda({
      ...base,
      citasTerapeuta: [{ ...cita("p2", "soc"), clave: "2026-10-12" }],
    }),
    "parcial",
  );
});
