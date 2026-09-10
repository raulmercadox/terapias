"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  assertSedeAccess,
  assertRolGestion,
} from "@/lib/session";
import {
  AREAS_FICHA,
  MODALIDADES_LENGUAJE,
  grupoAplica,
  normalizarResultados,
  type Resultados,
} from "./ficha";
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
const MODALIDADES = MODALIDADES_LENGUAJE;

const evaluacionSchema = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria."),
  evaluadorId: z.string().optional(),
  lugarNacimiento: z.string().optional(),
  numeroHermanos: z.string().optional(),
  nivelAcademico: z.string().optional(),
  centroEducativo: z.string().optional(),
  conviveMadre: z.boolean(),
  convivePadre: z.boolean(),
  conviveHermanos: z.boolean(),
  conviveOtros: z.string().optional(),
  relacionDetalle: z.string().optional(),
  diagnostico: z.string().optional(),
  medicacion: z.string().optional(),
  terapiasRealiza: z.string().optional(),
  dificultadesDormir: z.string().optional(),
  dificultadesComer: z.string().optional(),
  dificultadesPresenta: z.string().optional(),
  preescolar: z.string().optional(),
  escolar: z.string().optional(),
  comportamientoAula: z.string().optional(),
  rendimientoEscolar: z.string().optional(),
  dificultadesEscolares: z.string().optional(),
  modalidadLenguaje: z.enum(MODALIDADES).optional(),
  observacionSensorial: z.string().optional(),
  observacionMotriz: z.string().optional(),
  observacionGeneral: z.string().optional(),
  programaRecomendado: z.enum(PROGRAMAS).optional(),
  recomendaciones: z.string().optional(),
  aplicarPrograma: z.boolean(),
});

function parseEvaluacionForm(formData: FormData) {
  return evaluacionSchema.safeParse({
    fecha: opt(formData.get("fecha")) ?? "",
    evaluadorId: opt(formData.get("evaluadorId")),
    lugarNacimiento: opt(formData.get("lugarNacimiento")),
    numeroHermanos: opt(formData.get("numeroHermanos")),
    nivelAcademico: opt(formData.get("nivelAcademico")),
    centroEducativo: opt(formData.get("centroEducativo")),
    conviveMadre: formData.get("conviveMadre") === "on",
    convivePadre: formData.get("convivePadre") === "on",
    conviveHermanos: formData.get("conviveHermanos") === "on",
    conviveOtros: opt(formData.get("conviveOtros")),
    relacionDetalle: opt(formData.get("relacionDetalle")),
    diagnostico: opt(formData.get("diagnostico")),
    medicacion: opt(formData.get("medicacion")),
    terapiasRealiza: opt(formData.get("terapiasRealiza")),
    dificultadesDormir: opt(formData.get("dificultadesDormir")),
    dificultadesComer: opt(formData.get("dificultadesComer")),
    dificultadesPresenta: opt(formData.get("dificultadesPresenta")),
    preescolar: opt(formData.get("preescolar")),
    escolar: opt(formData.get("escolar")),
    comportamientoAula: opt(formData.get("comportamientoAula")),
    rendimientoEscolar: opt(formData.get("rendimientoEscolar")),
    dificultadesEscolares: opt(formData.get("dificultadesEscolares")),
    modalidadLenguaje: opt(formData.get("modalidadLenguaje")) as
      | "VERBAL"
      | "NO_VERBAL"
      | undefined,
    observacionSensorial: opt(formData.get("observacionSensorial")),
    observacionMotriz: opt(formData.get("observacionMotriz")),
    observacionGeneral: opt(formData.get("observacionGeneral")),
    programaRecomendado: opt(formData.get("programaRecomendado")) as
      | "ESCOLAR"
      | "INTERDIARIO"
      | "TERAPIAS"
      | undefined,
    recomendaciones: opt(formData.get("recomendaciones")),
    aplicarPrograma: formData.get("aplicarPrograma") === "on",
  });
}

/**
 * Lee del FormData los checklists de áreas: cada ítem del catálogo viene como
 * radio `res_<itemId>` (valor I/P/L o SI/NO; "" = sin evaluar) y, en las áreas
 * con observación, un texto `obs_<itemId>`.
 *
 * Los grupos que no corresponden a la modalidad de lenguaje elegida se ignoran:
 * el formulario los oculta pero sigue enviando sus inputs, y guardarlos dejaría
 * en la ficha resultados de una modalidad que no se está evaluando.
 */
function parseResultados(
  formData: FormData,
  modalidadLenguaje: string | undefined,
): Resultados {
  const crudo: Record<string, { valor?: string; obs?: string }> = {};
  for (const area of AREAS_FICHA) {
    for (const grupo of area.grupos) {
      if (!grupoAplica(grupo, modalidadLenguaje)) continue;
      for (const item of grupo.items) {
        crudo[item.id] = {
          valor: opt(formData.get(`res_${item.id}`)),
          obs: area.conObservacion
            ? opt(formData.get(`obs_${item.id}`))
            : undefined,
        };
      }
    }
  }
  return normalizarResultados(crudo);
}

function evaluacionData(
  d: z.infer<typeof evaluacionSchema>,
  resultados: Resultados,
) {
  return {
    fecha: new Date(d.fecha),
    evaluadorId: d.evaluadorId ?? null,
    lugarNacimiento: d.lugarNacimiento ?? null,
    numeroHermanos: d.numeroHermanos ?? null,
    nivelAcademico: d.nivelAcademico ?? null,
    centroEducativo: d.centroEducativo ?? null,
    conviveMadre: d.conviveMadre,
    convivePadre: d.convivePadre,
    conviveHermanos: d.conviveHermanos,
    conviveOtros: d.conviveOtros ?? null,
    relacionDetalle: d.relacionDetalle ?? null,
    diagnostico: d.diagnostico ?? null,
    medicacion: d.medicacion ?? null,
    terapiasRealiza: d.terapiasRealiza ?? null,
    dificultadesDormir: d.dificultadesDormir ?? null,
    dificultadesComer: d.dificultadesComer ?? null,
    dificultadesPresenta: d.dificultadesPresenta ?? null,
    preescolar: d.preescolar ?? null,
    escolar: d.escolar ?? null,
    comportamientoAula: d.comportamientoAula ?? null,
    rendimientoEscolar: d.rendimientoEscolar ?? null,
    dificultadesEscolares: d.dificultadesEscolares ?? null,
    resultados,
    modalidadLenguaje: d.modalidadLenguaje ?? null,
    observacionSensorial: d.observacionSensorial ?? null,
    observacionMotriz: d.observacionMotriz ?? null,
    observacionGeneral: d.observacionGeneral ?? null,
    programaRecomendado: d.programaRecomendado ?? null,
    recomendaciones: d.recomendaciones ?? null,
  };
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
  assertSedeAccess(user, paciente.sedeId);

  const parsed = parseEvaluacionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }
  const d = parsed.data;

  const errorEvaluador = await validarEvaluador(d.evaluadorId, paciente.sedeId);
  if (errorEvaluador) return { error: errorEvaluador };

  const resultados = parseResultados(formData, d.modalidadLenguaje);

  const evaluacion = await prisma.$transaction(async (tx) => {
    const ev = await tx.evaluacion.create({
      data: {
        sedeId: paciente.sedeId,
        pacienteId,
        ...evaluacionData(d, resultados),
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
    select: { sedeId: true, pacienteId: true, fecha: true },
  });
  if (!existente) return { error: "La evaluación no existe." };
  assertSedeAccess(user, existente.sedeId);

  const parsed = parseEvaluacionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }
  const d = parsed.data;

  const errorEvaluador = await validarEvaluador(d.evaluadorId, existente.sedeId);
  if (errorEvaluador) return { error: errorEvaluador };

  const resultados = parseResultados(formData, d.modalidadLenguaje);

  await prisma.evaluacion.update({
    where: { id: evaluacionId },
    data: evaluacionData(d, resultados),
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
  assertSedeAccess(user, existente.sedeId);

  await prisma.evaluacion.delete({ where: { id: evaluacionId } });

  revalidatePath(`/pacientes/${existente.pacienteId}`);
  redirect(`/pacientes/${existente.pacienteId}`);
}
