// Utilidades puras de horario / intervalos de atención.
// SIN "use server": se importan tanto en componentes cliente (formulario de
// paquete) como en server actions. Convención de día = getDay(): 0=Dom..6=Sáb.

export const DIA_NOMBRE: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

/** Días en orden de presentación: lunes a domingo (claves getDay()). */
export const DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0] as const;

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:mm" → minutos desde medianoche. NaN si el formato es inválido. */
export function aMinutos(hhmm: string): number {
  if (typeof hhmm !== "string" || !HORA_RE.test(hhmm)) return NaN;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** minutos → "HH:mm" (acotado a un día). */
export function aHHMM(min: number): string {
  const t = ((Math.round(min) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Suma `mins` minutos a una hora "HH:mm" (mismo día). */
export function sumarMinutos(hhmm: string, mins: number): string {
  return aHHMM(aMinutos(hhmm) + mins);
}

export type Intervalo = { inicio: string; fin: string };

/** Pasos de grilla disponibles en el calendario (minutos entre inicios). */
export const PASOS_GRILLA = [15, 30, 45, 60] as const;
/** Paso más fino ofrecido: el servidor valida el alineamiento contra este. */
export const PASO_GRILLA_MIN = 15;

/**
 * Genera las horas de inicio posibles dentro de [apertura, cierre): una cada
 * `paso` minutos (por defecto, cada `duracionMin`), siempre que la sesión
 * completa (`duracionMin`) quepa antes del cierre. `fin` = inicio + duración.
 * El paso y la duración son independientes: una grilla de 15 min puede ofrecer
 * inicios 9:00/9:15/9:30… para sesiones de 90 min. Devuelve [] si los datos
 * son inválidos.
 */
export function generarIntervalos(
  apertura: string,
  cierre: string,
  duracionMin: number,
  paso: number = duracionMin,
): Intervalo[] {
  const ini = aMinutos(apertura);
  const fin = aMinutos(cierre);
  if (Number.isNaN(ini) || Number.isNaN(fin)) return [];
  if (!(duracionMin > 0) || !(paso > 0)) return [];
  const out: Intervalo[] = [];
  for (let t = ini; t + duracionMin <= fin; t += paso) {
    out.push({ inicio: aHHMM(t), fin: aHHMM(t + duracionMin) });
  }
  return out;
}

/**
 * ¿`horaInicio` es un inicio válido? Debe estar alineado al `paso` desde la
 * apertura y la sesión completa debe caber antes del cierre. El servidor usa
 * `PASO_GRILLA_MIN` (el paso más fino del selector de vista) para aceptar
 * cualquier inicio que el calendario pueda ofrecer.
 */
export function esIntervaloValido(
  apertura: string,
  cierre: string,
  duracionMin: number,
  horaInicio: string,
  paso: number = duracionMin,
): boolean {
  const ini = aMinutos(apertura);
  const fin = aMinutos(cierre);
  const h = aMinutos(horaInicio);
  if (Number.isNaN(ini) || Number.isNaN(fin) || Number.isNaN(h)) return false;
  if (!(duracionMin > 0) || !(paso > 0)) return false;
  return h >= ini && (h - ini) % paso === 0 && h + duracionMin <= fin;
}

/** Date → "YYYY-MM-DD" en horario local (clave para comparar feriados). */
export function claveFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
