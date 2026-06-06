// Lógica de programación de fechas para las sesiones de un paquete.
// No es un Server Action: solo utilidades puras reutilizables por las actions.

/**
 * Devuelve los días de la semana (0=Dom .. 6=Sáb) en los que caen las sesiones
 * según la frecuencia semanal. Se reparten en días hábiles (Lun..Vie):
 *   1 -> [Lun]
 *   2 -> [Mar, Jue]
 *   3 -> [Lun, Mié, Vie]
 *   4 -> [Lun, Mar, Jue, Vie]
 *   5 -> [Lun, Mar, Mié, Jue, Vie]
 * Para frecuencias >5 se reparte en Lun..Vie de forma cíclica (días repetidos).
 */
function diasDeLaSemana(frecuencia: number): number[] {
  const f = Math.max(1, Math.min(5, frecuencia));
  const mapa: Record<number, number[]> = {
    1: [1], // Lun
    2: [2, 4], // Mar, Jue
    3: [1, 3, 5], // Lun, Mié, Vie
    4: [1, 2, 4, 5], // Lun, Mar, Jue, Vie
    5: [1, 2, 3, 4, 5], // Lun..Vie
  };
  return mapa[f];
}

/** Fecha (sin hora) a medianoche local. */
function aMedianoche(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Genera las fechas de las N sesiones a partir de `fechaInicio` repartidas
 * según `frecuenciaSemana` en días hábiles. La primera sesión cae en el primer
 * día válido (de la frecuencia) que sea >= fechaInicio.
 *
 * @returns array de Date (longitud = totalSesiones), ordenado cronológicamente.
 */
export function generarFechasSesiones(
  fechaInicio: Date,
  totalSesiones: number,
  frecuenciaSemana: number,
): Date[] {
  const dias = diasDeLaSemana(frecuenciaSemana);
  const fechas: Date[] = [];

  // Avanzamos día a día desde fechaInicio; tomamos los que coincidan con `dias`.
  const cursor = aMedianoche(fechaInicio);
  let guard = 0; // tope de seguridad por si frecuencia fuera 0 (no debería)
  const maxIteraciones = totalSesiones * 14 + 30;

  while (fechas.length < totalSesiones && guard < maxIteraciones) {
    if (dias.includes(cursor.getDay())) {
      fechas.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return fechas;
}

/**
 * Construye el payload de las Citas (sesiones) de un paquete, listo para
 * `prisma.cita.createMany`. Numera 1..N y asigna fechas según frecuencia.
 */
export function construirSesiones(opts: {
  sedeId: string;
  pacienteId: string;
  paqueteId: string;
  terapeutaId: string | null;
  totalSesiones: number;
  frecuenciaSemana: number;
  fechaInicio: Date;
  horaInicio?: string;
  horaFin?: string;
}) {
  const {
    sedeId,
    pacienteId,
    paqueteId,
    terapeutaId,
    totalSesiones,
    frecuenciaSemana,
    fechaInicio,
    horaInicio = "09:00",
    horaFin = "09:45",
  } = opts;

  const fechas = generarFechasSesiones(
    fechaInicio,
    totalSesiones,
    frecuenciaSemana,
  );

  return fechas.map((fecha, i) => ({
    sedeId,
    pacienteId,
    terapeutaId,
    paqueteId,
    numeroSesion: i + 1,
    fecha,
    horaInicio,
    horaFin,
    tipo: "SESION" as const,
    estado: "AGENDADA" as const,
    asistencia: "PENDIENTE" as const,
  }));
}

/** Última fecha de la programación (para `fechaFin` del paquete). */
export function fechaFinDeSesiones(
  fechaInicio: Date,
  totalSesiones: number,
  frecuenciaSemana: number,
): Date | null {
  const fechas = generarFechasSesiones(
    fechaInicio,
    totalSesiones,
    frecuenciaSemana,
  );
  return fechas.length ? fechas[fechas.length - 1] : null;
}
