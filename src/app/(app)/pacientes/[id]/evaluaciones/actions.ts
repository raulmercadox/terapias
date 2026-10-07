"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  assertSedeAccess,
  assertAccesoClinico,
  esAutorClinico,
  evaluadorParaGuardar,
} from "@/lib/session";
import { obtenerPlantilla } from "@/lib/plantillas";
import { normalizarPlantilla } from "@/lib/fichas/plantilla";
import { reconciliar, snapshotDe } from "@/lib/fichas/snapshot";
import { parseValores } from "@/components/ficha/form-datos";
import { fecha, fechaInput } from "@/lib/utils";
import { parseTratamiento, type LineaTratamiento } from "./tratamiento";
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

/**
 * La estructura de la ficha la manda su plantilla, así que aquí solo se validan
 * los datos que NO son del formulario clínico: la fecha, el evaluador y las
 * recomendaciones. El tratamiento sugerido se lee aparte (leerTratamiento).
 */
const evaluacionSchema = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria."),
  evaluadorId: z.string().optional(),
  recomendaciones: z.string().optional(),
});

function parseCampos(formData: FormData) {
  return evaluacionSchema.safeParse({
    fecha: opt(formData.get("fecha")) ?? "",
    evaluadorId: opt(formData.get("evaluadorId")),
    recomendaciones: opt(formData.get("recomendaciones")),
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

/**
 * Lee el tratamiento sugerido del formulario y verifica que sus terapias sean
 * de la sede del paciente.
 */
async function leerTratamiento(
  formData: FormData,
  sedeId: string,
): Promise<{ plazoSemanas: number; lineas: LineaTratamiento[] } | { error: string }> {
  const t = parseTratamiento(formData.get("plazoSemanas"), formData.get("tratamiento"));
  if ("error" in t) return t;
  const ids = t.lineas.map((l) => l.terapiaId);
  if (ids.length > 0) {
    const encontradas = await prisma.terapia.count({
      where: { id: { in: ids }, sedeId },
    });
    if (encontradas !== ids.length) {
      return { error: "Alguna terapia del tratamiento no pertenece a la sede." };
    }
  }
  return t;
}

/** Filas del tratamiento para `createMany`, en el orden del formulario. */
function filasTratamiento(evaluacionId: string, lineas: LineaTratamiento[]) {
  return lineas.map((l, orden) => ({ evaluacionId, orden, ...l }));
}

export async function crearEvaluacion(
  pacienteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { sedeId: true },
  });
  if (!paciente) return { error: "El paciente no existe." };
  await assertSedeAccess(user, paciente.sedeId);
  await assertAccesoClinico(user, pacienteId);

  const parsed = parseCampos(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }
  const d = {
    ...parsed.data,
    evaluadorId: evaluadorParaGuardar(user, parsed.data.evaluadorId),
  };

  const errorEvaluador = await validarEvaluador(d.evaluadorId, paciente.sedeId);
  if (errorEvaluador) return { error: errorEvaluador };

  const tratamiento = await leerTratamiento(formData, paciente.sedeId);
  if ("error" in tratamiento) return { error: tratamiento.error };

  // La ficha congela la plantilla con la que se aplicó: es un instrumento
  // fechado y firmado (ver src/lib/fichas/snapshot.ts).
  const { plantilla, version } = await obtenerPlantilla(user.centroId, "EVALUACION");

  const evaluacion = await prisma.$transaction(async (tx) => {
    // Solo una evaluación abierta por paciente: la nueva reemplaza a la anterior.
    await tx.evaluacion.updateMany({
      where: { pacienteId, cerradaEn: null },
      data: { cerradaEn: new Date() },
    });
    const ev = await tx.evaluacion.create({
      data: {
        sedeId: paciente.sedeId,
        pacienteId,
        evaluadorId: d.evaluadorId ?? null,
        fecha: new Date(d.fecha),
        estructura: json(snapshotDe(plantilla)),
        valores: json(parseValores(formData, plantilla)),
        plantillaVersion: version,
        recomendaciones: d.recomendaciones ?? null,
        plazoSemanas: tratamiento.plazoSemanas,
      },
    });
    await tx.evaluacionTerapia.createMany({
      data: filasTratamiento(ev.id, tratamiento.lineas),
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

  const existente = await prisma.evaluacion.findUnique({
    where: { id: evaluacionId },
    select: {
      sedeId: true,
      pacienteId: true,
      fecha: true,
      estructura: true,
      evaluadorId: true,
    },
  });
  if (!existente) return { error: "La evaluación no existe." };
  await assertSedeAccess(user, existente.sedeId);
  await assertAccesoClinico(user, existente.pacienteId);
  if (!esAutorClinico(user, existente.evaluadorId)) {
    return { error: "Solo puede editar las evaluaciones que usted registró." };
  }

  const parsed = parseCampos(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }
  const d = {
    ...parsed.data,
    evaluadorId: evaluadorParaGuardar(user, parsed.data.evaluadorId),
  };

  const errorEvaluador = await validarEvaluador(d.evaluadorId, existente.sedeId);
  if (errorEvaluador) return { error: errorEvaluador };

  // Se edita con la estructura CONGELADA de la ficha, no con la vigente del
  // centro: corregir una evaluación no debe reinterpretarla con otra plantilla.
  const estructura = normalizarPlantilla(existente.estructura);

  const tratamiento = await leerTratamiento(formData, existente.sedeId);
  if ("error" in tratamiento) return { error: tratamiento.error };

  // Los paquetes ya creados desde esta evaluación no cambian: copiaron el
  // tratamiento al agendarse.
  await prisma.$transaction([
    prisma.evaluacion.update({
      where: { id: evaluacionId },
      data: {
        evaluadorId: d.evaluadorId ?? null,
        fecha: new Date(d.fecha),
        valores: json(parseValores(formData, estructura)),
        recomendaciones: d.recomendaciones ?? null,
        plazoSemanas: tratamiento.plazoSemanas,
      },
    }),
    prisma.evaluacionTerapia.deleteMany({ where: { evaluacionId } }),
    prisma.evaluacionTerapia.createMany({
      data: filasTratamiento(evaluacionId, tratamiento.lineas),
    }),
  ]);

  // Si se corrige el día de la ficha, su entrada de seguimiento lo acompaña.
  if (fechaInput(existente.fecha) !== d.fecha) {
    await prisma.interaccion.updateMany({
      where: { evaluacionId },
      data: { fecha: fechaEntradaEvaluacion(d.fecha, new Date()) },
    });
    revalidatePath("/seguimiento");
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

  const existente = await prisma.evaluacion.findUnique({
    where: { id: evaluacionId },
    select: { sedeId: true, pacienteId: true, valores: true, evaluadorId: true },
  });
  if (!existente) throw new Error("La evaluación no existe.");
  await assertSedeAccess(user, existente.sedeId);
  await assertAccesoClinico(user, existente.pacienteId);
  if (!esAutorClinico(user, existente.evaluadorId)) {
    throw new Error("Solo puede actualizar las evaluaciones que usted registró.");
  }

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

/**
 * Cierra o reabre una evaluación. Cerrada, ya no sirve para crear ni renovar
 * paquetes; los paquetes ya creados desde ella no cambian. Solo puede haber
 * una abierta por paciente: para reabrir, la otra debe estar cerrada.
 */
export async function cambiarCierreEvaluacion(
  evaluacionId: string,
  cerrar: boolean,
): Promise<{ error?: string }> {
  const user = await requireUser();

  const existente = await prisma.evaluacion.findUnique({
    where: { id: evaluacionId },
    select: { sedeId: true, pacienteId: true, evaluadorId: true },
  });
  if (!existente) throw new Error("La evaluación no existe.");
  await assertSedeAccess(user, existente.sedeId);
  await assertAccesoClinico(user, existente.pacienteId);
  if (!esAutorClinico(user, existente.evaluadorId)) {
    throw new Error("Solo puede cerrar las evaluaciones que usted registró.");
  }

  const error = await prisma.$transaction(async (tx) => {
    if (!cerrar) {
      const otra = await tx.evaluacion.findFirst({
        where: {
          pacienteId: existente.pacienteId,
          cerradaEn: null,
          id: { not: evaluacionId },
        },
        select: { fecha: true },
      });
      if (otra) {
        return `El paciente ya tiene abierta la evaluación del ${fecha(otra.fecha)}. Ciérrala antes de reabrir esta.`;
      }
    }
    await tx.evaluacion.update({
      where: { id: evaluacionId },
      data: { cerradaEn: cerrar ? new Date() : null },
    });
    return null;
  });
  if (error) return { error };

  revalidatePath(`/pacientes/${existente.pacienteId}`);
  revalidatePath(`/pacientes/${existente.pacienteId}/evaluaciones/${evaluacionId}`);
  revalidatePath("/sesiones", "layout");
  return {};
}
