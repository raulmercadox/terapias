// Lógica de programación de fechas para las sesiones de un paquete.
// No es un Server Action: solo utilidades puras reutilizables por las actions.

import { sumarMinutos, claveFecha } from "./horario";

/** Una entrada del horario semanal: día (getDay 0=Dom..6=Sáb) y hora de inicio. */
export type HorarioDia = { dia: number; horaInicio: string };

/** Fecha (sin hora) a medianoche local. */
function aMedianoche(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type SesionGenerada = {
  fecha: Date;
  horaInicio: string;
  horaFin: string;
};

/**
 * Genera las fechas/horas de las N sesiones a partir de `fechaInicio`,
 * repartidas según el `horario` semanal (cada día con su hora), saltando los
 * feriados. La hora de fin se calcula con `duracionMin`. Los feriados NO
 * consumen sesión: se saltan y se sigue buscando el siguiente día válido.
 *
 * @returns array ordenado cronológicamente (longitud = totalSesiones, salvo
 *          que no haya días válidos o se agote el tope de seguridad).
 */
export function generarSesiones(opts: {
  totalSesiones: number;
  horario: HorarioDia[];
  duracionMin: number;
  fechaInicio: Date;
  feriados?: Set<string>;
}): SesionGenerada[] {
  const { totalSesiones, horario, duracionMin, fechaInicio, feriados } = opts;

  // Mapa día → hora de inicio.
  const porDia = new Map<number, string>();
  for (const h of horario) porDia.set(h.dia, h.horaInicio);

  const out: SesionGenerada[] = [];
  if (porDia.size === 0 || totalSesiones < 1) return out;

  const cursor = aMedianoche(fechaInicio);
  let guard = 0;
  const maxIteraciones = totalSesiones * 14 + 60;

  while (out.length < totalSesiones && guard < maxIteraciones) {
    const hora = porDia.get(cursor.getDay());
    if (hora && !feriados?.has(claveFecha(cursor))) {
      out.push({
        fecha: new Date(cursor),
        horaInicio: hora,
        horaFin: sumarMinutos(hora, duracionMin),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return out;
}

/**
 * Construye el payload de las Citas (sesiones) de un paquete, listo para
 * `prisma.cita.createMany`. Numera 1..N.
 */
export function construirSesiones(opts: {
  sedeId: string;
  pacienteId: string;
  paqueteId: string;
  terapeutaId: string | null;
  totalSesiones: number;
  horario: HorarioDia[];
  duracionMin: number;
  fechaInicio: Date;
  feriados?: Set<string>;
}) {
  const sesiones = generarSesiones(opts);

  return sesiones.map((s, i) => ({
    sedeId: opts.sedeId,
    pacienteId: opts.pacienteId,
    terapeutaId: opts.terapeutaId,
    paqueteId: opts.paqueteId,
    numeroSesion: i + 1,
    fecha: s.fecha,
    horaInicio: s.horaInicio,
    horaFin: s.horaFin,
    tipo: "SESION" as const,
    estado: "AGENDADA" as const,
    asistencia: "PENDIENTE" as const,
  }));
}
