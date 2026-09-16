// Cobranza de paquetes: hasta cuándo se puede pagar según el periodo de gracia.
// Fechas "YYYY-MM-DD" (hoy = hoyLima(), fechas del paquete = claveFecha()).
// La duración usa fechaInicio/fechaFin del paquete, que se fijan al crearlo o
// renovarlo y no cambian al reprogramar: son las sesiones originales.
import type { TipoGracia } from "@prisma/client";
import { soles } from "@/lib/utils";
import { diasEntreISO, sumarDiasISO } from "../sesiones/vencimiento";

export type ReglaGracia = { tipo: TipoGracia; valor: number; diasAviso: number };

export type EstadoCobro = "vencido" | "por-vencer";

export const COBRO_COLOR: Record<EstadoCobro, "red" | "amber"> = {
  vencido: "red",
  "por-vencer": "amber",
};

/** La configuración del centro, en la forma que usan estas reglas. */
export function reglaDeConfiguracion(c: {
  graciaTipo: TipoGracia;
  graciaValor: number;
  diasAvisoCobro: number;
}): ReglaGracia {
  return { tipo: c.graciaTipo, valor: c.graciaValor, diasAviso: c.diasAvisoCobro };
}

/**
 * Días de gracia desde la primera sesión. Por porcentaje se redondea hacia
 * arriba (favorece al paciente): 50 % de 25 días = 13.
 */
export function diasDeGracia(regla: ReglaGracia, inicioISO: string, finISO: string): number {
  if (regla.tipo === "DIAS") return Math.max(0, Math.floor(regla.valor));
  const duracion = Math.max(0, diasEntreISO(inicioISO, finISO));
  return Math.ceil((regla.valor * duracion) / 100);
}

/**
 * Último día para pagar. La primera sesión cuenta como día 1: con 15 días de
 * gracia desde el 01/09 se puede pagar hasta el 15/09 y el 16/09 ya está vencido.
 */
export function fechaLimitePago(regla: ReglaGracia, inicioISO: string, finISO: string): string {
  return sumarDiasISO(inicioISO, diasDeGracia(regla, inicioISO, finISO) - 1);
}

/** Vencido si ya pasó la fecha límite; por vencer si faltan `diasAviso` días o menos. */
export function estadoCobro({
  saldo,
  limiteISO,
  hoy,
  diasAviso,
}: {
  saldo: number;
  limiteISO: string;
  hoy: string;
  diasAviso: number;
}): EstadoCobro | null {
  if (!(saldo > 0)) return null;
  if (hoy > limiteISO) return "vencido";
  if (hoy >= sumarDiasISO(limiteISO, -diasAviso)) return "por-vencer";
  return null;
}

/**
 * Saldo, fecha límite y estado de cobro de un paquete. `fechaInicio`/`fechaFin`
 * como "YYYY-MM-DD"; sin fecha de inicio no hay plazo que calcular.
 */
export function evaluarCobro(
  p: { precio: number; pagado: number; fechaInicio: string | null; fechaFin: string | null },
  regla: ReglaGracia,
  hoy: string,
): { saldo: number; limiteISO: string | null; estado: EstadoCobro | null } {
  const saldo = Math.round((p.precio - p.pagado) * 100) / 100;
  if (!p.fechaInicio) return { saldo, limiteISO: null, estado: null };
  const limiteISO = fechaLimitePago(regla, p.fechaInicio, p.fechaFin ?? p.fechaInicio);
  return {
    saldo,
    limiteISO,
    estado: estadoCobro({ saldo, limiteISO, hoy, diasAviso: regla.diasAviso }),
  };
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** "YYYY-MM-DD" → "dd/mm/aaaa". */
export const fechaDeISO = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`;
const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? "" : "s"}`;

/** "Venció el 15/09 · 3 días de atraso", "Vence hoy", "Vence el 20/09 · en 5 días". */
export function textoCobro(estado: EstadoCobro, limiteISO: string, hoy: string): string {
  if (estado === "vencido") {
    return `Venció el ${dm(limiteISO)} · ${plural(diasEntreISO(limiteISO, hoy), "día")} de atraso`;
  }
  const faltan = diasEntreISO(hoy, limiteISO);
  if (faltan === 0) return "Vence hoy";
  if (faltan === 1) return "Vence mañana";
  return `Vence el ${dm(limiteISO)} · en ${plural(faltan, "día")}`;
}

/** "50 % de la duración de la terapia" o "10 días desde la primera sesión". */
export function describirRegla(regla: Pick<ReglaGracia, "tipo" | "valor">): string {
  return regla.tipo === "PORCENTAJE"
    ? `${regla.valor} % de la duración de la terapia`
    : `${plural(regla.valor, "día")} desde la primera sesión`;
}

/**
 * Recordatorio de pago para WhatsApp. El centro se saluda con su propio
 * nombre: cada uno tiene su marca, nunca una fija.
 */
export function mensajeWhatsAppCobro({
  centro,
  sede,
  paciente,
  saldo,
  limiteISO,
  estado,
}: {
  centro: string;
  sede: string;
  paciente: string;
  saldo: number;
  limiteISO: string;
  estado: EstadoCobro;
}): string {
  const plazo =
    estado === "vencido"
      ? `cuyo plazo de pago venció el ${fechaDeISO(limiteISO)}`
      : `con fecha límite de pago el ${fechaDeISO(limiteISO)}`;
  return (
    `Hola, le saludamos de ${centro} (sede ${sede}). ` +
    `Le recordamos que el paquete de terapias de ${paciente} tiene un saldo pendiente de ${soles(saldo)}, ${plazo}. ` +
    `Puede acercarse a la sede o escribirnos por este medio. ¡Gracias!`
  );
}
