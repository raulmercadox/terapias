// Reglas puras de disponibilidad de una franja (cliente y servidor).
//
// Un terapeuta atiende una sola sesión a la vez, salvo terapias GRUPALES: la
// franja se comparte solo con citas de la MISMA terapia y el MISMO horario
// (inicio y fin), hasta `maxParticipantes` pacientes distintos. Una cita sin
// terapia (citas sueltas o anteriores al catálogo) ocupa la franja entera.

import { enVacaciones, type RangoVacaciones } from "./horario";

export type ModalidadTerapia = "INDIVIDUAL" | "GRUPAL";

export type TerapiaCupo = {
  id: string;
  modalidad: ModalidadTerapia;
  maxParticipantes: number;
};

/** Cita ya agendada del terapeuta (mismo día que la franja evaluada). */
export type CitaFranja = {
  pacienteId: string;
  terapiaId: string | null;
  horaInicio: string;
  horaFin: string;
};

/**
 * - libre: nadie en la franja.
 * - parcial: grupal con cupo (ya hay participantes de la misma terapia).
 * - lleno: grupal sin cupo.
 * - ocupado: hay una sesión que no se puede compartir.
 */
export type EstadoCupo = "libre" | "parcial" | "lleno" | "ocupado";

/** Solapamiento de rangos "HH:mm" (comparación lexicográfica). */
export function solapan(aI: string, aF: string, bI: string, bF: string): boolean {
  return aI < bF && aF > bI;
}

/**
 * Evalúa si `pacienteId` puede tomar la franja [horaInicio, horaFin) con el
 * terapeuta, dadas las citas del terapeuta ese día (no canceladas). Las citas
 * del mismo paciente se ignoran: ese cruce lo valida la regla del paciente.
 */
export function evaluarCupo<C extends CitaFranja>(
  citasTerapeuta: C[],
  franja: { horaInicio: string; horaFin: string },
  terapia: TerapiaCupo | null,
  pacienteId?: string,
): { estado: EstadoCupo; ocupados: number; ejemplo?: C } {
  const cruces = citasTerapeuta.filter(
    (c) =>
      (!pacienteId || c.pacienteId !== pacienteId) &&
      solapan(franja.horaInicio, franja.horaFin, c.horaInicio, c.horaFin),
  );
  if (cruces.length === 0) return { estado: "libre", ocupados: 0 };

  const ocupados = new Set(cruces.map((c) => c.pacienteId)).size;
  const compartible =
    terapia?.modalidad === "GRUPAL" &&
    cruces.every(
      (c) =>
        c.terapiaId === terapia.id &&
        c.horaInicio === franja.horaInicio &&
        c.horaFin === franja.horaFin,
    );
  if (!compartible) return { estado: "ocupado", ocupados, ejemplo: cruces[0] };
  if (ocupados + 1 > terapia.maxParticipantes) {
    return { estado: "lleno", ocupados, ejemplo: cruces[0] };
  }
  return { estado: "parcial", ocupados, ejemplo: cruces[0] };
}

/** Estado de una celda del calendario de agendamiento. */
export type EstadoCelda =
  | EstadoCupo
  | "pacienteOcupado"
  | "feriado"
  | "vacaciones"
  | "pasado";

/** Cita ocupada (precalculada con su clave "YYYY-MM-DD"). */
export type CitaOcupada = CitaFranja & { clave: string };

/**
 * Estado de la celda (fecha `clave` + franja) para el paciente y terapeuta
 * elegidos. `citasTerapeuta` y `citasPaciente` pueden traer citas de otros
 * días: se filtran por `clave`.
 */
export function estadoCelda(opts: {
  clave: string;
  horaInicio: string;
  horaFin: string;
  hoyClave: string;
  feriados: Set<string>;
  vacaciones: RangoVacaciones[];
  citasTerapeuta: CitaOcupada[];
  citasPaciente: CitaOcupada[];
  terapia: TerapiaCupo | null;
  pacienteId?: string;
}): EstadoCelda {
  const { clave, horaInicio, horaFin } = opts;
  if (clave < opts.hoyClave) return "pasado";
  if (opts.feriados.has(clave)) return "feriado";
  if (enVacaciones(opts.vacaciones, clave)) return "vacaciones";
  if (
    opts.citasPaciente.some(
      (c) => c.clave === clave && solapan(horaInicio, horaFin, c.horaInicio, c.horaFin),
    )
  ) {
    return "pacienteOcupado";
  }
  return evaluarCupo(
    opts.citasTerapeuta.filter((c) => c.clave === clave),
    { horaInicio, horaFin },
    opts.terapia,
    opts.pacienteId,
  ).estado;
}
