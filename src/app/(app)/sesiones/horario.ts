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

/** Pausa de refrigerio de la sede: ninguna sesión puede invadirla. */
export type Refrigerio = { inicio: string; fin: string };

/**
 * Arma el refrigerio a partir de los dos campos de la sede. Devuelve null si
 * no está configurado (es opcional) o si el par no es utilizable: así el resto
 * del código trata "sin refrigerio" y "mal configurado" de la misma forma, sin
 * llegar a bloquear horas por un dato corrupto.
 */
export function refrigerioDe(
  inicio?: string | null,
  fin?: string | null,
): Refrigerio | null {
  if (!inicio || !fin) return null;
  const i = aMinutos(inicio);
  const f = aMinutos(fin);
  if (Number.isNaN(i) || Number.isNaN(f) || f <= i) return null;
  return { inicio, fin };
}

/**
 * ¿La sesión [inicio, fin) se cruza con el refrigerio? Basta con invadirlo un
 * minuto: una sesión de 12:30–13:15 choca con un refrigerio de 13:00–14:00.
 * Terminar justo cuando empieza (o empezar justo cuando acaba) no choca.
 */
export function chocaConRefrigerio(
  inicio: string,
  fin: string,
  refrigerio?: Refrigerio | null,
): boolean {
  if (!refrigerio) return false;
  const i = aMinutos(inicio);
  const f = aMinutos(fin);
  if (Number.isNaN(i) || Number.isNaN(f)) return false;
  return i < aMinutos(refrigerio.fin) && f > aMinutos(refrigerio.inicio);
}

/** Pasos de grilla predefinidos en el calendario (minutos entre inicios).
 *  La sede puede configurar además cualquier múltiplo de 5 entre 5 y 120. */
export const PASOS_GRILLA = [15, 30, 45, 60] as const;
/** Paso más fino aceptado: el servidor valida el alineamiento contra este.
 *  Es 5 porque el intervalo configurable es siempre múltiplo de 5. */
export const PASO_GRILLA_MIN = 5;

/**
 * Opciones del selector "Intervalo" del calendario: la lista configurada por
 * la sede (o los pasos predefinidos si está vacía) más el paso inicial de la
 * sede por si no estuviera en su propia lista. Ordenadas y sin duplicados.
 */
export function opcionesPaso(
  configurados: number[],
  inicial: number,
): number[] {
  const base = configurados.length > 0 ? configurados : PASOS_GRILLA;
  const pasos = new Set<number>(base);
  if (inicial > 0) pasos.add(inicial);
  return [...pasos].sort((a, b) => a - b);
}

/** Un tramo continuo de atención: inicios cada `paso` desde `apertura`. */
function generarTramo(
  apertura: string,
  cierre: string,
  duracionMin: number,
  paso: number,
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
 * Genera las horas de inicio posibles dentro de [apertura, cierre): una cada
 * `paso` minutos (por defecto, cada `duracionMin`), siempre que la sesión
 * completa (`duracionMin`) quepa antes del cierre. `fin` = inicio + duración.
 * El paso y la duración son independientes: una grilla de 15 min puede ofrecer
 * inicios 9:00/9:15/9:30… para sesiones de 90 min. Devuelve [] si los datos
 * son inválidos.
 *
 * El refrigerio parte el día en dos tramos y cada uno arranca su propia
 * rejilla. Si no, la del día entero se alinea a la apertura y la primera hora
 * tras el descanso cae donde toque: con sesiones de 40 min desde las 09:00, el
 * siguiente inicio tras un refrigerio que acaba a las 14:00 sería 14:20, y las
 * 14:00 —cuando el terapeuta ya está libre— no se podrían elegir.
 */
export function generarIntervalos(
  apertura: string,
  cierre: string,
  duracionMin: number,
  paso: number = duracionMin,
  refrigerio?: Refrigerio | null,
): Intervalo[] {
  if (!refrigerio) return generarTramo(apertura, cierre, duracionMin, paso);

  // Se acotan los tramos al horario por si el refrigerio quedara fuera de él.
  const antes = refrigerio.inicio < cierre ? refrigerio.inicio : cierre;
  const despues = refrigerio.fin > apertura ? refrigerio.fin : apertura;
  return [
    ...generarTramo(apertura, antes, duracionMin, paso),
    ...generarTramo(despues, cierre, duracionMin, paso),
  ];
}

/**
 * ¿`horaInicio` es un inicio válido? Debe estar alineado al `paso` desde la
 * apertura, la sesión completa debe caber antes del cierre y no puede invadir
 * el refrigerio de la sede (si lo tiene configurado). El servidor usa
 * `PASO_GRILLA_MIN` (el paso más fino del selector de vista) para aceptar
 * cualquier inicio que el calendario pueda ofrecer.
 */
export function esIntervaloValido(
  apertura: string,
  cierre: string,
  duracionMin: number,
  horaInicio: string,
  paso: number = duracionMin,
  refrigerio?: Refrigerio | null,
): boolean {
  const ini = aMinutos(apertura);
  const fin = aMinutos(cierre);
  const h = aMinutos(horaInicio);
  if (Number.isNaN(ini) || Number.isNaN(fin) || Number.isNaN(h)) return false;
  if (!(duracionMin > 0) || !(paso > 0)) return false;
  if (!(h >= ini && (h - ini) % paso === 0 && h + duracionMin <= fin)) {
    return false;
  }
  return !chocaConRefrigerio(horaInicio, aHHMM(h + duracionMin), refrigerio);
}

/** Lo que hace falta de la sede para saber si una franja cabe en su horario. */
export type HorarioSede = {
  horaApertura: string;
  horaCierre: string;
  diasLaborales: number[];
  refrigerioInicio?: string | null;
  refrigerioFin?: string | null;
};

/**
 * ¿Por qué esta franja no cabe en el horario de la sede? Devuelve el mensaje
 * para el usuario, o null si es válida. Reúne las tres reglas que comparten
 * agendar una cita suelta, reprogramar una sesión y renovar un paquete: día
 * laborable, rango de atención y refrigerio.
 *
 * Recibe el día suelto (getDay()) y no una fecha porque al renovar se valida la
 * plantilla semanal heredada, que se repite y no tiene una fecha concreta.
 */
export function motivoFueraDeHorarioEnDia(
  sede: HorarioSede,
  dia: number,
  horaInicio: string,
  horaFin: string,
): string | null {
  if (!sede.diasLaborales.includes(dia)) {
    return `La sede no atiende los ${DIA_NOMBRE[dia]}.`;
  }
  if (horaInicio < sede.horaApertura || horaFin > sede.horaCierre) {
    return `El horario de atención es de ${sede.horaApertura} a ${sede.horaCierre}.`;
  }
  const refrigerio = refrigerioDe(sede.refrigerioInicio, sede.refrigerioFin);
  if (chocaConRefrigerio(horaInicio, horaFin, refrigerio)) {
    return `Esa hora se cruza con el refrigerio de ${refrigerio!.inicio} a ${refrigerio!.fin}.`;
  }
  return null;
}

/** Igual que `motivoFueraDeHorarioEnDia`, para una fecha concreta. */
export function motivoFueraDeHorario(
  sede: HorarioSede,
  fecha: Date,
  horaInicio: string,
  horaFin: string,
): string | null {
  return motivoFueraDeHorarioEnDia(sede, fecha.getDay(), horaInicio, horaFin);
}

/** Date → "YYYY-MM-DD" en horario local (clave para comparar feriados). */
export function claveFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
