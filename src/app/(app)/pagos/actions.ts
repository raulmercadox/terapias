"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireActiveSede,
  assertSedeAccess,
  assertRolGestion,
} from "@/lib/session";
import { crearPagoConRecibo } from "./crear-pago";

const CONCEPTOS = [
  "MATRICULA",
  "MATERIALES",
  "MENSUALIDAD",
  "PAQUETE_SESIONES",
  "EVALUACION",
  "OTRO",
] as const;

const METODOS = [
  "EFECTIVO",
  "YAPE",
  "PLIN",
  "TRANSFERENCIA",
  "TARJETA",
] as const;

const pagoSchema = z.object({
  pacienteId: z.string().min(1, "Selecciona un paciente."),
  paqueteId: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  concepto: z.enum(CONCEPTOS),
  descripcion: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  monto: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n > 0, "El monto debe ser mayor a 0."),
  metodoPago: z.enum(METODOS),
  referencia: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  fechaPago: z.string().min(1, "Indica la fecha de pago."),
});

export type RegistrarPagoState = {
  error?: string;
};

export async function registrarPago(
  _prev: RegistrarPagoState,
  formData: FormData,
): Promise<RegistrarPagoState> {
  const user = await requireUser();
  assertRolGestion(user);
  const sedeId = await requireActiveSede(user);
  await assertSedeAccess(user, sedeId);

  const parsed = pagoSchema.safeParse({
    pacienteId: formData.get("pacienteId"),
    paqueteId: formData.get("paqueteId") ?? undefined,
    concepto: formData.get("concepto"),
    descripcion: formData.get("descripcion") ?? undefined,
    monto: formData.get("monto"),
    metodoPago: formData.get("metodoPago"),
    referencia: formData.get("referencia") ?? undefined,
    fechaPago: formData.get("fechaPago"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;

  // El paciente debe pertenecer a la sede activa.
  const paciente = await prisma.paciente.findFirst({
    where: { id: data.pacienteId, sedeId },
    select: { id: true },
  });
  if (!paciente) {
    return { error: "El paciente no pertenece a la sede activa." };
  }

  // Si se vincula un paquete, debe ser del mismo paciente y sede.
  if (data.paqueteId) {
    const paquete = await prisma.paquete.findFirst({
      where: { id: data.paqueteId, sedeId, pacienteId: data.pacienteId },
      select: { id: true },
    });
    if (!paquete) {
      return { error: "El paquete seleccionado no es válido para este paciente." };
    }
  }

  // fechaPago a mediodía local para evitar desfases de zona horaria.
  const fecha = new Date(`${data.fechaPago}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return { error: "La fecha de pago no es válida." };
  }

  let pagoId: string;
  try {
    ({ id: pagoId } = await crearPagoConRecibo({
      sedeId,
      pacienteId: data.pacienteId,
      paqueteId: data.paqueteId,
      concepto: data.concepto,
      descripcion: data.descripcion,
      monto: data.monto,
      metodoPago: data.metodoPago,
      referencia: data.referencia,
      fechaPago: fecha,
    }));
  } catch {
    // Probable colisión del @@unique([sedeId, numeroRecibo]) por concurrencia.
    return {
      error: "No se pudo generar el recibo (intenta de nuevo).",
    };
  }

  revalidatePath("/pagos");
  redirect(`/pagos/${pagoId}/recibo`);
}
