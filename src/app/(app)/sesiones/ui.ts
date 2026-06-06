// Etiquetas y colores de Badge compartidos por las vistas del módulo SESIONES.
import type { EstadoPaquete, Asistencia } from "@prisma/client";

type BadgeColor = "green" | "red" | "amber" | "sky" | "slate";

export const estadoPaqueteColor: Record<EstadoPaquete, BadgeColor> = {
  ACTIVO: "sky",
  COMPLETADO: "green",
  VENCIDO: "amber",
  ANULADO: "slate",
};

export const estadoPaqueteLabel: Record<EstadoPaquete, string> = {
  ACTIVO: "Activo",
  COMPLETADO: "Completado",
  VENCIDO: "Vencido",
  ANULADO: "Anulado",
};

export const asistenciaColor: Record<Asistencia, BadgeColor> = {
  PENDIENTE: "slate",
  ASISTIO: "green",
  FALTO: "red",
  TARDANZA: "amber",
};

export const asistenciaLabel: Record<Asistencia, string> = {
  PENDIENTE: "Pendiente",
  ASISTIO: "Asistió",
  FALTO: "Faltó",
  TARDANZA: "Tardanza",
};
