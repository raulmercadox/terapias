"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, assertSedeAccess, assertRolGestion } from "@/lib/session";
import { CANALES, parseInputLima } from "./seguimiento";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

// Margen para relojes desfasados entre el navegador y el servidor.
const TOLERANCIA_FUTURO_MS = 10 * 60 * 1000;

const interaccionSchema = z.object({
  direccion: z.enum(["ENTRADA", "SALIDA"]),
  canal: z.enum(CANALES),
  resultado: z.enum(["CONTACTADO", "SIN_RESPUESTA"]).optional(),
  nota: z.string().trim().max(2000, "La nota es demasiado larga").optional(),
});

function revalidarSeguimiento(pacienteId: string) {
  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath("/seguimiento");
  revalidatePath("/");
}

export async function registrarInteraccion(
  pacienteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertRolGestion(user);

  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { sedeId: true },
  });
  if (!paciente) return { error: "El paciente no existe." };
  await assertSedeAccess(user, paciente.sedeId);

  const parsed = interaccionSchema.safeParse({
    direccion: formData.get("direccion"),
    canal: formData.get("canal"),
    resultado: formData.get("resultado") || undefined,
    nota: formData.get("nota") || undefined,
  });
  if (!parsed.success) return { error: "Revisa los datos de la interacción." };
  const d = parsed.data;

  const fecha = parseInputLima(String(formData.get("fecha") ?? ""));
  if (!fecha) {
    return { fieldErrors: { fecha: "Indica la fecha y hora del contacto." } };
  }
  if (fecha.getTime() > Date.now() + TOLERANCIA_FUTURO_MS) {
    return { fieldErrors: { fecha: "La fecha no puede ser futura." } };
  }
  if (d.direccion === "SALIDA" && !d.resultado) {
    return { fieldErrors: { resultado: "Indica si se logró el contacto." } };
  }

  await prisma.interaccion.create({
    data: {
      sedeId: paciente.sedeId,
      pacienteId,
      direccion: d.direccion,
      canal: d.canal,
      fecha,
      // El resultado solo tiene sentido en las salidas.
      resultado: d.direccion === "SALIDA" ? d.resultado : null,
      nota: d.nota || null,
      autor: user.nombre ?? null,
    },
  });

  revalidarSeguimiento(pacienteId);
  return {};
}

export async function eliminarInteraccion(id: string): Promise<void> {
  const user = await requireUser();
  assertRolGestion(user);

  const interaccion = await prisma.interaccion.findUnique({
    where: { id },
    select: { sedeId: true, pacienteId: true },
  });
  if (!interaccion) return;
  await assertSedeAccess(user, interaccion.sedeId);

  await prisma.interaccion.delete({ where: { id } });
  revalidarSeguimiento(interaccion.pacienteId);
}
