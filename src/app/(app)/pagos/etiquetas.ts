// Etiquetas de pagos compartidas por la lista, el recibo y el reporte Excel.
import type { ConceptoPago, MetodoPago } from "@prisma/client";

export const METODO_LABEL: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

export const CONCEPTO_LABEL: Record<ConceptoPago, string> = {
  MATRICULA: "Matrícula",
  MATERIALES: "Materiales",
  MENSUALIDAD: "Mensualidad",
  PAQUETE_SESIONES: "Paquete de sesiones",
  EVALUACION: "Evaluación",
  OTRO: "Otro",
};
