import type { EstadoCita, Asistencia, TipoCita } from "@prisma/client";
import { aMinutos, aHHMM, type Refrigerio } from "../sesiones/horario";

/* ── Semana (lunes–domingo) ───────────────────────────── */

/** Lunes de la semana que contiene `d`, a medianoche local. */
export function lunesDeLaSemana(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const dow = r.getDay(); // 0=Dom, 1=Lun, ... 6=Sáb
  const diff = dow === 0 ? -6 : 1 - dow;
  r.setDate(r.getDate() + diff);
  return r;
}

/** Convierte "YYYY-MM-DD" a Date local (mediodía). Devuelve null si es inválido. */
export function parseFechaISO(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Formatea un Date como "YYYY-MM-DD" en horario local. */
export function aISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sumarDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

/** Devuelve los 7 días (Lun–Dom) a partir del lunes dado. */
export function diasDeLaSemana(lunes: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/* ── Etiquetas y colores ──────────────────────────────── */

export const ESTADO_COLOR: Record<EstadoCita, "sky" | "green" | "red"> = {
  AGENDADA: "sky",
  ATENDIDA: "green",
  CANCELADA: "red",
};

export const ASISTENCIA_COLOR: Record<
  Asistencia,
  "slate" | "green" | "red" | "amber"
> = {
  PENDIENTE: "slate",
  ASISTIO: "green",
  FALTO: "red",
  TARDANZA: "amber",
};

export const ASISTENCIA_LABEL: Record<Asistencia, string> = {
  PENDIENTE: "Pendiente",
  ASISTIO: "Asistió",
  FALTO: "Faltó",
  TARDANZA: "Tardanza",
};

export const TIPO_LABEL: Record<TipoCita, string> = {
  CONSULTA: "Consulta",
  EVALUACION: "Evaluación",
  SESION: "Sesión",
};

/* ── Vista consolidada (bloques libres / ocupados) ────── */

export type TipoBloque = "ocupado" | "libre" | "refrigerio";

/** Tramo continuo del día de un terapeuta. `citas` solo cuenta en los ocupados. */
export type Bloque = {
  inicio: string;
  fin: string;
  tipo: TipoBloque;
  citas: number;
};

/** Horario de atención de un día laborable (null = no se atiende ese día). */
export type Jornada = {
  apertura: string;
  cierre: string;
  refrigerio: Refrigerio | null;
};

type Tramo = [number, number];

/** Quita de [a, b) cada uno de los `cortes`; devuelve lo que sobra, en orden. */
function restar([a, b]: Tramo, cortes: Tramo[]): Tramo[] {
  let tramos: Tramo[] = a < b ? [[a, b]] : [];
  for (const [c, d] of cortes) {
    tramos = tramos.flatMap(([x, y]): Tramo[] => {
      if (d <= x || c >= y) return [[x, y]];
      const out: Tramo[] = [];
      if (c > x) out.push([x, c]);
      if (d < y) out.push([d, y]);
      return out;
    });
  }
  return tramos;
}

/**
 * Resume el día de un terapeuta en bloques continuos. Las citas que se tocan o
 * se solapan (9:00–9:45 y 9:45–10:30, o dos grupales a la misma hora) forman un
 * solo bloque ocupado; lo que queda de la jornada es libre, salvo el refrigerio.
 * Las citas fuera del horario de atención se muestran igual como ocupadas.
 * Sin jornada (día no laborable o feriado) solo hay bloques ocupados.
 */
export function consolidarDia(
  citas: { horaInicio: string; horaFin: string }[],
  jornada: Jornada | null,
): Bloque[] {
  const ocupados: { ini: number; fin: number; citas: number }[] = [];
  const tramos = citas
    .map((c): Tramo => [aMinutos(c.horaInicio), aMinutos(c.horaFin)])
    .filter(([i, f]) => !Number.isNaN(i) && !Number.isNaN(f) && f > i)
    .sort((x, y) => x[0] - y[0]);
  for (const [i, f] of tramos) {
    const ultimo = ocupados.at(-1);
    if (ultimo && i <= ultimo.fin) {
      ultimo.fin = Math.max(ultimo.fin, f);
      ultimo.citas++;
    } else {
      ocupados.push({ ini: i, fin: f, citas: 1 });
    }
  }

  const bloques: Bloque[] = ocupados.map((o) => ({
    inicio: aHHMM(o.ini),
    fin: aHHMM(o.fin),
    tipo: "ocupado",
    citas: o.citas,
  }));
  const agregar = (tipo: TipoBloque) => ([x, y]: Tramo) =>
    bloques.push({ inicio: aHHMM(x), fin: aHHMM(y), tipo, citas: 0 });

  const apertura = jornada ? aMinutos(jornada.apertura) : NaN;
  const cierre = jornada ? aMinutos(jornada.cierre) : NaN;
  if (!Number.isNaN(apertura) && !Number.isNaN(cierre)) {
    const cortes = ocupados.map((o): Tramo => [o.ini, o.fin]);
    const r = jornada!.refrigerio;
    const refrigerio: Tramo | null = r
      ? [aMinutos(r.inicio), aMinutos(r.fin)]
      : null;
    restar(
      [apertura, cierre],
      refrigerio ? [...cortes, refrigerio] : cortes,
    ).forEach(agregar("libre"));
    // Si una cita invade el refrigerio, esa parte se ve ocupada.
    if (refrigerio) {
      restar(
        [Math.max(refrigerio[0], apertura), Math.min(refrigerio[1], cierre)],
        cortes,
      ).forEach(agregar("refrigerio"));
    }
  }

  return bloques.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/* ── Teléfono / WhatsApp (Perú) ───────────────────────── */

/**
 * Normaliza un teléfono peruano a formato internacional sin "+":
 * solo dígitos; si quedan 9 dígitos antepone 51.
 * Devuelve null si no hay suficientes dígitos.
 */
export function normalizarTelefonoPe(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 9) digits = `51${digits}`;
  if (digits.length < 9) return null;
  return digits;
}
