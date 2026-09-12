type ClassValue = string | number | null | false | undefined;

/** Une clases condicionalmente (mini-clsx, sin dependencias). */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

/** Formatea un monto en soles. Acepta number, string o Prisma.Decimal. */
export function soles(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return PEN.format(Number.isFinite(n) ? n : 0);
}

// Los campos "solo fecha" (sin hora) se almacenan anclados a la medianoche de
// la zona del servidor (en producción America/New_York, UTC-4/-5). El día UTC
// de esa instancia coincide con la fecha pretendida, así que SIEMPRE formateamos
// e interpretamos estos campos en UTC. Esto evita que, al renderizarse en el
// navegador (Perú, UTC-5), la fecha retroceda un día. NO usar para timestamps
// reales (createdAt, fecha+hora de pago): para eso está `fechaHora`.
const DATE_FMT = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function fecha(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d);
}

/**
 * Valor "YYYY-MM-DD" para un <input type="date"> a partir de un campo solo-fecha
 * (Date o ISO). Se interpreta en UTC, coherente con `fecha`, para que el día
 * mostrado/precargado no dependa de la zona horaria del navegador.
 */
export function fechaInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// en-CA formatea como "YYYY-MM-DD", justo lo que espera un <input type="date">.
const HOY_LIMA_FMT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Lima",
});

/**
 * Día de hoy en Perú como "YYYY-MM-DD", para precargar un <input type="date">.
 * No usar `fechaInput(new Date())` para esto: lee el día en UTC, y desde las
 * 19:00 de Lima en UTC ya es mañana.
 */
export function hoyLima(ahora: Date = new Date()): string {
  return HOY_LIMA_FMT.format(ahora);
}

const DATETIME_FMT = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Lima",
});

/** Fecha y hora (zona horaria de Perú), ej. "07/06/2026, 12:45 p. m.". */
export function fechaHora(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : DATETIME_FMT.format(d);
}

/** Edad en años a partir de la fecha de nacimiento. */
export function edad(fechaNac: Date | string | null | undefined): string {
  if (!fechaNac) return "—";
  const d = typeof fechaNac === "string" ? new Date(fechaNac) : fechaNac;
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return `${years} años`;
}

const CONECTORES = new Set(["de", "del", "la", "las", "los", "el", "y"]);

/**
 * Iniciales para el cuadro del logo: las 2 primeras palabras significativas.
 * "Centro de Terapias Arcoíris" → "CT"; "Arcoíris" → "A".
 */
export function iniciales(nombre: string): string {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => p && !CONECTORES.has(p.toLowerCase()))
    .slice(0, 2)
    .map((p) => Array.from(p)[0])
    .join("");
  return letras.toLocaleUpperCase("es") || "T";
}

export function nombreCompleto(p: {
  nombres: string;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
}): string {
  return [p.apellidoPaterno, p.apellidoMaterno, p.nombres]
    .filter(Boolean)
    .join(" ")
    .trim();
}
