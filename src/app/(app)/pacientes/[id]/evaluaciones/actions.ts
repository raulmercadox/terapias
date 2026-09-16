"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, assertSedeAccess, assertRolGestion } from "@/lib/session";
import { obtenerPlantilla } from "@/lib/plantillas";
import { normalizarPlantilla } from "@/lib/fichas/plantilla";
import { reconciliar, snapshotDe } from "@/lib/fichas/snapshot";
import { parseValores } from "@/components/ficha/form-datos";
import { fechaInput } from "@/lib/utils";
import { fechaEntradaEvaluacion } from "../../../seguimiento/seguimiento";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/** Convierte "" en undefined para campos opcionales del formulario. */
function opt(value: FormDataEntryValue | null): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

const PROGRAMAS = ["ESCOLAR", "INTERDIARIO", "TERAPIAS"] as const;

/**
 * La estructura de la ficha la manda su plantilla, así que aquí solo se validan
 * los datos que NO son del formulario clínico: la fecha, el evaluador y el
 * programa recomendado, que sale de la ficha hacia Paciente.programa.
 */
const evaluacionSchema = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria."),
  evaluadorId: z.string().optional(),
  programaRecomendado: z.enum(PROGRAMAS).optional(),
  recomendaciones: z.string().optional(),
  aplicarPrograma: z.boolean(),
});

function parseCampos(formData: FormData) {
  return evaluacionSchema.safeParse({
    fecha: opt(formData.get("fecha")) ?? "",
    evaluadorId: opt(formData.get("evaluadorId")),
    programaRecomendado: opt(formData.get("programaRecomendado")) as
      | (typeof PROGRAMAS)[number]
      | undefined,
    recomendaciones: opt(formData.get("recomendaciones")),
    aplicarPrograma: formData.get("aplicarPrograma") === "on",
  });
}

/** Valida que el evaluador (si se indicó) sea un terapeuta de la sede. */
async function validarEvaluador(
  evaluadorId: string | undefined,
  sedeId: string,
): Promise<string | null> {
  if (!evaluadorId) return null;
  const t = await prisma.terapeuta.findFirst({
    where: { id: evaluadorId, sedeId },
    select: { id: true },
  });
  return t ? null : "El evaluador no pertenece a la sede del paciente.";
}

const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;

export async function crearEvaluacion(
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

  const parsed = parseCampos(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }
  const d = parsed.data;

  const errorEvaluador = await validarEvaluador(d.evaluadorId, paciente.sedeId);
  if (errorEvaluador) return { error: errorEvaluador };

  // La ficha congela la plantilla con la que se aplicó: es un instrumento
  // fechado y firmado (ver src/lib/fichas/snapshot.ts).
  const { plantilla, version } = await obtenerPlantilla(user.centroId, "EVALUACION");

  const evaluacion = await prisma.$transaction(async (tx) => {
    const ev = await tx.evaluacion.create({
      data: {
        sedeId: paciente.sedeId,
        pacienteId,
        evaluadorId: d.evaluadorId ?? null,
        fecha: new Date(d.fecha),
        estructura: json(snapshotDe(plantilla)),
        valores: json(parseValores(formData, plantilla)),
        plantillaVersion: version,
        programaRecomendado: d.programaRecomendado ?? null,
        recomendaciones: d.recomendaciones ?? null,
      },
    });

    // Quien se evalúa sin tener paquete vino a conocer el centro: entra a la
    // bandeja de seguimiento hasta que alguien lo contacte. La reevaluación
    // de un paciente que ya lleva terapia no. Un paquete anulado no cuenta.
    const paquetes = await tx.paquete.count({
      where: { pacienteId, estado: { not: "ANULADO" } },
    });
    if (paquetes === 0) {
      await tx.interaccion.create({
        data: {
          sedeId: paciente.sedeId,
          pacienteId,
          evaluacionId: ev.id,
          direccion: "ENTRADA",
          canal: "EVALUACION",
          fecha: fechaEntradaEvaluacion(d.fecha, new Date()),
          autor: user.nombre ?? null,
        },
      });
    }
    return ev;
  });

  if (d.aplicarPrograma && d.programaRecomendado) {
    await prisma.paciente.update({
      where: { id: pacienteId },
      data: { programa: d.programaRecomendado },
    });
  }

  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath("/seguimiento");
  revalidatePath("/");
  redirect(`/pacientes/${pacienteId}/evaluaciones/${evaluacion.id}`);
}

export async function actualizarEvaluacion(
  evaluacionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertRolGestion(user);

  const existente = await prisma.evaluacion.findUnique({
    where: { id: evaluacionId },
    select: { sedeId: true, pacienteId: true, fecha: true, estructura: true },
  });
  if (!existente) return { error: "La evaluación no existe." };
  await assertSedeAccess(user, existente.sedeId);

  const parsed = parseCampos(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }
  const d = parsed.data;

  const errorEvaluador = await validarEvaluador(d.evaluadorId, existente.sedeId);
  if (errorEvaluador) return { error: errorEvaluador };

  // Se edita con la estructura CONGELADA de la ficha, no con la vigente del
  // centro: corregir una evaluación no debe reinterpretarla con otra plantilla.
  const estructura = normalizarPlantilla(existente.estructura);

  await prisma.evaluacion.update({
    where: { id: evaluacionId },
    data: {
      evaluadorId: d.evaluadorId ?? null,
      fecha: new Date(d.fecha),
      valores: json(parseValores(formData, estructura)),
      programaRecomendado: d.programaRecomendado ?? null,
      recomendaciones: d.recomendaciones ?? null,
    },
  });

  // Si se corrige el día de la ficha, su entrada de seguimiento lo acompaña.
  if (fechaInput(existente.fecha) !== d.fecha) {
    await prisma.interaccion.updateMany({
      where: { evaluacionId },
      data: { fecha: fechaEntradaEvaluacion(d.fecha, new Date()) },
    });
    revalidatePath("/seguimiento");
  }

  if (d.aplicarPrograma && d.programaRecomendado) {
    await prisma.paciente.update({
      where: { id: existente.pacienteId },
      data: { programa: d.programaRecomendado },
    });
  }

  revalidatePath(`/pacientes/${existente.pacienteId}`);
  redirect(`/pacientes/${existente.pacienteId}/evaluaciones/${evaluacionId}`);
}

/**
 * Pasa una ficha antigua a la plantilla vigente del centro. Es una decisión
 * explícita del profesional: lo registrado que siga teniendo campo conserva su
 * valor y lo que la plantilla nueva ya no tiene queda como dato antiguo.
 */
export async function actualizarAPlantillaVigente(
  evaluacionId: string,
): Promise<void> {
  const user = await requireUser();
  assertRolGestion(user);

  const existente = await prisma.evaluacion.findUnique({
    where: { id: evaluacionId },
    select: { sedeId: true, pacienteId: true, valores: true },
  });
  if (!existente) throw new Error("La evaluación no existe.");
  await assertSedeAccess(user, existente.sedeId);

  const { plantilla, version } = await obtenerPlantilla(user.centroId, "EVALUACION");
  const { estructura, valores } = reconciliar(existente.valores, plantilla);

  await prisma.evaluacion.update({
    where: { id: evaluacionId },
    data: {
      estructura: json(estructura),
      valores: json(valores),
      plantillaVersion: version,
    },
  });

  revalidatePath(`/pacientes/${existente.pacienteId}/evaluaciones/${evaluacionId}`);
}

/** Solo el administrador puede eliminar una ficha de evaluación. */
export async function eliminarEvaluacion(evaluacionId: string) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") {
    throw new Error("No tiene permisos para esta operación.");
  }

  const existente = await prisma.evaluacion.findUnique({
    where: { id: evaluacionId },
    select: { sedeId: true, pacienteId: true },
  });
  if (!existente) throw new Error("La evaluación no existe.");
  await assertSedeAccess(user, existente.sedeId);

  await prisma.evaluacion.delete({ where: { id: evaluacionId } });

  revalidatePath(`/pacientes/${existente.pacienteId}`);
  redirect(`/pacientes/${existente.pacienteId}`);
}
