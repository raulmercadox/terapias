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

/**
 * Divide [apertura, cierre) en bloques de `duracionMin`. Solo incluye bloques
 * que terminen en/antes de `cierre`. Devuelve [] si los datos son inválidos.
 */
export function generarIntervalos(
  apertura: string,
  cierre: string,
  duracionMin: number,
): Intervalo[] {
  const ini = aMinutos(apertura);
  const fin = aMinutos(cierre);
  if (Number.isNaN(ini) || Number.isNaN(fin) || !(duracionMin > 0)) return [];
  const out: Intervalo[] = [];
  for (let t = ini; t + duracionMin <= fin; t += duracionMin) {
    out.push({ inicio: aHHMM(t), fin: aHHMM(t + duracionMin) });
  }
  return out;
}

/** ¿`horaInicio` es el inicio de un intervalo válido dentro del horario? */
export function esIntervaloValido(
  apertura: string,
  cierre: string,
  duracionMin: number,
  horaInicio: string,
): boolean {
  return generarIntervalos(apertura, cierre, duracionMin).some(
    (i) => i.inicio === horaInicio,
  );
}

/** Date → "YYYY-MM-DD" en horario local (clave para comparar feriados). */
export function claveFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
