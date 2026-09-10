import type {
  CanalInteraccion,
  DireccionInteraccion,
  ResultadoSalida,
} from "@prisma/client";

/* ── Etiquetas ────────────────────────────────────────── */

export const CANALES = [
  "LLAMADA",
  "WHATSAPP",
  "VISITA",
  "EVALUACION",
  "CORREO",
  "REDES",
  "OTRO",
] as const satisfies readonly CanalInteraccion[];

export const CANAL_LABEL: Record<CanalInteraccion, string> = {
  LLAMADA: "Llamada",
  WHATSAPP: "WhatsApp",
  VISITA: "Visita al centro",
  EVALUACION: "Evaluación inicial",
  CORREO: "Correo",
  REDES: "Redes sociales",
  OTRO: "Otro",
};

export const DIRECCION_LABEL: Record<DireccionInteraccion, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
};

export const RESULTADO_LABEL: Record<ResultadoSalida, string> = {
  CONTACTADO: "Contactado",
  SIN_RESPUESTA: "Sin respuesta",
};

/* ── Regla de pendiente ───────────────────────────────── */

// Una ENTRADA queda atendida cuando existe una SALIDA con resultado
// CONTACTADO en la misma fecha u otra posterior. Una SALIDA SIN_RESPUESTA
// es solo un intento: el interesado sigue en la bandeja.
//
// La consulta SQL de la bandeja (seguimiento/page.tsx) replica esta misma
// regla para poder ordenar y paginar en la base; si cambias una, cambia la otra.

export type InteraccionBase = {
  direccion: DireccionInteraccion;
  resultado: ResultadoSalida | null;
  fecha: Date;
};

export type Pendiente = {
  /** Fecha de la entrada sin respuesta más antigua: define el orden de la bandeja. */
  desde: Date;
  /** Entradas sin respuesta (el interesado insistió más de una vez). */
  entradas: number;
  /** Salidas sin respuesta desde `desde`. */
  intentos: number;
  ultimoIntento: Date | null;
};

/** Una salida sin resultado se trata como contacto: solo SIN_RESPUESTA no cierra. */
function esContacto(i: InteraccionBase): boolean {
  return i.direccion === "SALIDA" && i.resultado !== "SIN_RESPUESTA";
}

/** Estado de seguimiento de un paciente, o null si no tiene nada pendiente. */
export function pendienteDe(interacciones: InteraccionBase[]): Pendiente | null {
  let ultimoContacto = Number.NEGATIVE_INFINITY;
  for (const i of interacciones) {
    if (esContacto(i)) {
      ultimoContacto = Math.max(ultimoContacto, i.fecha.getTime());
    }
  }

  const sinRespuesta = interacciones.filter(
    (i) => i.direccion === "ENTRADA" && i.fecha.getTime() > ultimoContacto,
  );
  if (sinRespuesta.length === 0) return null;

  const desde = Math.min(...sinRespuesta.map((i) => i.fecha.getTime()));
  const intentos = interacciones.filter(
    (i) =>
      i.direccion === "SALIDA" &&
      i.resultado === "SIN_RESPUESTA" &&
      i.fecha.getTime() >= desde,
  );
  const ultimoIntento =
    intentos.length === 0
      ? null
      : new Date(Math.max(...intentos.map((i) => i.fecha.getTime())));

  return {
    desde: new Date(desde),
    entradas: sinRespuesta.length,
    intentos: intentos.length,
    ultimoIntento,
  };
}

/* ── Fechas en hora de Perú ───────────────────────────── */

// El servidor de producción corre en America/New_York, pero la fecha y hora
// que escribe el usuario en <input type="datetime-local"> es hora de Lima.
// Perú no tiene horario de verano: UTC-5 fijo todo el año.
const OFFSET_LIMA = "-05:00";

const LIMA_PARTES = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Lima",
});

function partesLima(d: Date) {
  const p = Object.fromEntries(
    LIMA_PARTES.formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** "YYYY-MM-DDTHH:mm" en hora de Lima, para precargar un datetime-local. */
export function aInputLima(d: Date): string {
  const { dia, hora } = partesLima(d);
  return `${dia}T${hora}`;
}

/** Interpreta "YYYY-MM-DDTHH:mm" como hora de Lima. Null si es inválido. */
export function parseInputLima(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00${OFFSET_LIMA}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Fecha y hora de la entrada que genera una ficha de evaluación, cuya fecha
 * es solo el día ("YYYY-MM-DD"). Si es de hoy, la hora real del registro; si
 * se registra con atraso, el mediodía de Lima de ese día, para que la bandeja
 * la ordene por cuándo vino el paciente. Nunca queda en el futuro.
 */
export function fechaEntradaEvaluacion(dia: string, ahora: Date): Date {
  if (dia === aInputLima(ahora).slice(0, 10)) return ahora;
  const mediodia = parseInputLima(`${dia}T12:00`);
  if (!mediodia || mediodia > ahora) return ahora;
  return mediodia;
}

/** Días calendario (en Lima) entre `desde` y `ahora`: hoy = 0, ayer = 1. */
export function diasDesde(desde: Date, ahora: Date): number {
  const a = Date.parse(partesLima(desde).dia);
  const b = Date.parse(partesLima(ahora).dia);
  return Math.round((b - a) / 86_400_000);
}

/** Tiempo que lleva esperando contacto: "desde hoy", "1 día", "5 días". */
export function tiempoEspera(dias: number): string {
  if (dias <= 0) return "desde hoy";
  return dias === 1 ? "1 día" : `${dias} días`;
}
