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

const DATE_FMT = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function fecha(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d);
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
