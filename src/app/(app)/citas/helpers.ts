import type { EstadoCita, Asistencia, TipoCita } from "@prisma/client";

/* ── Semana (lunes–sábado) ────────────────────────────── */

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
] as const;

/** Devuelve los 6 días (Lun–Sáb) a partir del lunes dado. */
export function diasDeLaSemana(lunes: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i));
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
