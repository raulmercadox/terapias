// Utilidades compartidas por los guiones de demostración (demo.ts y
// demo-fisio.ts): fechas relativas a HOY, sesiones de un paquete y pagos con el
// correlativo que asignaría la app.
import type { PrismaClient } from "@prisma/client";

/* ── Fechas ──────────────────────────────────────────────── */

/** Hoy a medianoche local (convención de los campos "solo fecha"). */
export function hoy(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Medianoche local de hoy + n días. */
export function dia(n: number): Date {
  const d = hoy();
  d.setDate(d.getDate() + n);
  return d;
}

/** Mediodía local: los pagos se guardan así (evita desfases de zona). */
export function mediodia(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

export function claveFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function sumarMinutos(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/* ── Sesiones ────────────────────────────────────────────── */

export type Franja = { dia: number; hora: string }; // dia: getDay() 0=Dom..6=Sáb

/**
 * Fechas de las N sesiones desde `inicio`, repitiendo el horario semanal.
 * `saltar` descarta días (feriados, vacaciones), como hace la app al generar.
 */
export function generarSesiones(
  inicio: Date,
  total: number,
  horario: Franja[],
  duracionMin: number,
  saltar: (d: Date) => boolean = () => false,
) {
  const porDia = new Map(horario.map((h) => [h.dia, h.hora]));
  const out: { fecha: Date; horaInicio: string; horaFin: string }[] = [];
  const cursor = new Date(inicio);
  let guardia = 0;
  while (out.length < total && guardia < total * 14 + 60) {
    const hora = porDia.get(cursor.getDay());
    if (hora && !saltar(cursor)) {
      out.push({
        fecha: new Date(cursor),
        horaInicio: hora,
        horaFin: sumarMinutos(hora, duracionMin),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
    guardia++;
  }
  return out;
}

/* ── Personas ────────────────────────────────────────────── */

/** Teléfonos ficticios (9 dígitos, prefijo 9) para el botón de WhatsApp. */
export function telefono(i: number): string {
  return `9${String(11223344 + i * 137).padStart(8, "0")}`;
}

/* ── Pago con correlativo por sede, como lo hace la app ───── */

export type MetodoDemo = "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA" | "TARJETA";

export type PagoDemo = {
  sedeId: string;
  sedeNombre: string;
  pacienteId: string;
  paqueteId: string | null;
  concepto: "MATRICULA" | "MATERIALES" | "MENSUALIDAD" | "PAQUETE_SESIONES" | "EVALUACION" | "OTRO";
  monto: number;
  saldo: number;
  metodoPago: MetodoDemo;
  fecha: Date;
  descripcion?: string;
};

function prefijoSede(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return (limpio || "SED").slice(0, 3).padEnd(3, "X");
}

/** Devuelve `crearPago`, que numera los recibos de cada sede desde 1. */
export function creadorDePagos(prisma: PrismaClient) {
  const correlativos = new Map<string, number>();

  return async function crearPago(p: PagoDemo) {
    const prefijo = prefijoSede(p.sedeNombre);
    const clave = `${p.sedeId}|${prefijo}`;
    const siguiente = (correlativos.get(clave) ?? 0) + 1;
    correlativos.set(clave, siguiente);

    await prisma.pago.create({
      data: {
        sedeId: p.sedeId,
        pacienteId: p.pacienteId,
        paqueteId: p.paqueteId,
        numeroRecibo: `${prefijo}-${String(siguiente).padStart(6, "0")}`,
        concepto: p.concepto,
        descripcion: p.descripcion,
        monto: p.monto,
        saldo: p.saldo,
        metodoPago: p.metodoPago,
        referencia:
          p.metodoPago === "TRANSFERENCIA" ? `Op. ${100000 + siguiente} — BCP` : null,
        fechaPago: mediodia(p.fecha),
      },
    });
  };
}
