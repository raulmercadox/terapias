"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, assertSedeAccess, assertRolGestion } from "@/lib/session";
import { obtenerPlantilla } from "@/lib/plantillas";
import { parseValores } from "@/components/ficha/form-datos";
import type { Prisma } from "@prisma/client";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const historiaSchema = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria."),
});

/**
 * La estructura de la historia la manda la plantilla HISTORIA del centro, así
 * que aquí solo se valida la fecha: el resto de los campos se reconstruyen y
 * sanean contra la plantilla (ver components/ficha/form-datos.ts).
 */
export async function crearHistoria(
  pacienteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertRolGestion(user);

  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { sedeId: true, historiaClinica: { select: { id: true } } },
  });
  if (!paciente) return { error: "El paciente no existe." };
  await assertSedeAccess(user, paciente.sedeId);
  if (paciente.historiaClinica) {
    return { error: "Este paciente ya tiene una historia clínica registrada." };
  }

  const parsed = historiaSchema.safeParse({ fecha: String(formData.get("fecha") ?? "") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  const { plantilla } = await obtenerPlantilla(user.centroId, "HISTORIA");

  await prisma.historiaClinica.create({
    data: {
      sedeId: paciente.sedeId,
      pacienteId,
      fecha: new Date(parsed.data.fecha),
      valores: parseValores(formData, plantilla) as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/pacientes/${pacienteId}`);
  redirect(`/pacientes/${pacienteId}/historia`);
}

export async function actualizarHistoria(
  historiaId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertRolGestion(user);

  const existente = await prisma.historiaClinica.findUnique({
    where: { id: historiaId },
    select: { sedeId: true, pacienteId: true, valores: true },
  });
  if (!existente) return { error: "La historia clínica no existe." };
  await assertSedeAccess(user, existente.sedeId);

  const parsed = historiaSchema.safeParse({ fecha: String(formData.get("fecha") ?? "") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  const { plantilla } = await obtenerPlantilla(user.centroId, "HISTORIA");
  const nuevos = parseValores(formData, plantilla);

  // Lo registrado con campos que ya no están en la plantilla no se pierde al
  // editar: el formulario no los muestra, así que no vendrían en el FormData.
  const previos = (existente.valores ?? {}) as Record<string, unknown>;
  const conocidos = new Set(
    plantilla.secciones.flatMap((s) => s.grupos.flatMap((g) => g.campos.map((c) => c.id))),
  );
  const conservados: Record<string, unknown> = {};
  for (const [id, valor] of Object.entries(previos)) {
    if (!conocidos.has(id)) conservados[id] = valor;
  }

  await prisma.historiaClinica.update({
    where: { id: historiaId },
    data: {
      fecha: new Date(parsed.data.fecha),
      valores: { ...conservados, ...nuevos } as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/pacientes/${existente.pacienteId}`);
  redirect(`/pacientes/${existente.pacienteId}/historia`);
}

/** Solo el administrador puede eliminar una historia clínica. */
export async function eliminarHistoria(historiaId: string) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") {
    throw new Error("No tiene permisos para esta operación.");
  }

  const existente = await prisma.historiaClinica.findUnique({
    where: { id: historiaId },
    select: { sedeId: true, pacienteId: true },
  });
  if (!existente) throw new Error("La historia clínica no existe.");
  await assertSedeAccess(user, existente.sedeId);

  await prisma.historiaClinica.delete({ where: { id: historiaId } });

  revalidatePath(`/pacientes/${existente.pacienteId}`);
  redirect(`/pacientes/${existente.pacienteId}`);
}
