"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireActiveSede, assertSedeAccess } from "@/lib/session";

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
  saldo: z.coerce
    .number()
    .refine((n) => Number.isFinite(n) && n >= 0, "El saldo no puede ser negativo.")
    .default(0),
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

/** Prefijo de sede: primeras 3 letras del nombre en mayúsculas (solo A-Z). */
function prefijoSede(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita marcas de acento (diacríticos)
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  const base = (limpio || "SED").slice(0, 3);
  return base.padEnd(3, "X"); // garantiza 3 caracteres
}

/** Extrae el número del último recibo con un prefijo dado, ej "SJL-000042" -> 42. */
function numeroDeRecibo(numeroRecibo: string, prefijo: string): number {
  const m = numeroRecibo.match(new RegExp(`^${prefijo}-(\\d+)$`));
  return m ? parseInt(m[1], 10) : 0;
}

export async function registrarPago(
  _prev: RegistrarPagoState,
  formData: FormData,
): Promise<RegistrarPagoState> {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  assertSedeAccess(user, sedeId);

  const parsed = pagoSchema.safeParse({
    pacienteId: formData.get("pacienteId"),
    paqueteId: formData.get("paqueteId") ?? undefined,
    concepto: formData.get("concepto"),
    descripcion: formData.get("descripcion") ?? undefined,
    monto: formData.get("monto"),
    saldo: formData.get("saldo") ?? 0,
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
    pagoId = await prisma.$transaction(async (tx) => {
      const sede = await tx.sede.findUniqueOrThrow({
        where: { id: sedeId },
        select: { nombre: true },
      });
      const prefijo = prefijoSede(sede.nombre);

      // Último recibo de la sede con este prefijo (orden lexicográfico ==
      // numérico porque el padding es fijo a 6 dígitos).
      const ultimo = await tx.pago.findFirst({
        where: { sedeId, numeroRecibo: { startsWith: `${prefijo}-` } },
        orderBy: { numeroRecibo: "desc" },
        select: { numeroRecibo: true },
      });

      const siguiente = ultimo ? numeroDeRecibo(ultimo.numeroRecibo, prefijo) + 1 : 1;
      const numeroRecibo = `${prefijo}-${String(siguiente).padStart(6, "0")}`;

      const creado = await tx.pago.create({
        data: {
          sedeId,
          pacienteId: data.pacienteId,
          paqueteId: data.paqueteId,
          numeroRecibo,
          concepto: data.concepto,
          descripcion: data.descripcion,
          monto: data.monto,
          saldo: data.saldo,
          metodoPago: data.metodoPago,
          referencia: data.referencia,
          fechaPago: fecha,
        },
        select: { id: true },
      });

      return creado.id;
    });
  } catch {
    // Probable colisión del @@unique([sedeId, numeroRecibo]) por concurrencia.
    return {
      error: "No se pudo generar el recibo (intenta de nuevo).",
    };
  }

  revalidatePath("/pagos");
  redirect(`/pagos/${pagoId}/recibo`);
}
