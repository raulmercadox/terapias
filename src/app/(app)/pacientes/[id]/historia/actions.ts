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
import { normalizarFamiliares, type Familiar } from "./historia";

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

const historiaSchema = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria."),
  lugarNacimiento: z.string().optional(),
  padreApoderado: z.string().optional(),
  historiaPrePostnatal: z.string().optional(),
  presentacionDificultad: z.string().optional(),
  signosSintomas: z.string().optional(),
  tempranaCentro: z.string().optional(),
  tempranaAdaptacion: z.string().optional(),
  kinderCentro: z.string().optional(),
  kinderAdaptacion: z.string().optional(),
  evolucionMejoria: z.string().optional(),
  examenesRealizados: z.string().optional(),
  tratamientosRecibidos: z.string().optional(),
  indicacionesDoctor: z.string().optional(),
  medicinasRecomendadas: z.string().optional(),
  dosis: z.string().optional(),
  tiempoInicio: z.string().optional(),
  mejoriaMedicacion: z.string().optional(),
  alimentacion: z.string().optional(),
  controlEsfinteres: z.string().optional(),
  sueno: z.string().optional(),
  autonomiaPersonal: z.string().optional(),
  reaccionRechazo: z.boolean(),
  reaccionIndiferencia: z.boolean(),
  reaccionAceptacion: z.boolean(),
  reaccionPreocupacion: z.boolean(),
  reaccionVerguenza: z.boolean(),
  reaccionDetalle: z.string().optional(),
  creencias: z.string().optional(),
  cambiosCrianza: z.string().optional(),
  usoCastigo: z.string().optional(),
  comportamientoApego: z.string().optional(),
  enfermedadesFamiliares: z.string().optional(),
  caracterPadres: z.string().optional(),
  observacionesEntrevista: z.string().optional(),
});

function parseHistoriaForm(formData: FormData) {
  return historiaSchema.safeParse({
    fecha: opt(formData.get("fecha")) ?? "",
    lugarNacimiento: opt(formData.get("lugarNacimiento")),
    padreApoderado: opt(formData.get("padreApoderado")),
    historiaPrePostnatal: opt(formData.get("historiaPrePostnatal")),
    presentacionDificultad: opt(formData.get("presentacionDificultad")),
    signosSintomas: opt(formData.get("signosSintomas")),
    tempranaCentro: opt(formData.get("tempranaCentro")),
    tempranaAdaptacion: opt(formData.get("tempranaAdaptacion")),
    kinderCentro: opt(formData.get("kinderCentro")),
    kinderAdaptacion: opt(formData.get("kinderAdaptacion")),
    evolucionMejoria: opt(formData.get("evolucionMejoria")),
    examenesRealizados: opt(formData.get("examenesRealizados")),
    tratamientosRecibidos: opt(formData.get("tratamientosRecibidos")),
    indicacionesDoctor: opt(formData.get("indicacionesDoctor")),
    medicinasRecomendadas: opt(formData.get("medicinasRecomendadas")),
    dosis: opt(formData.get("dosis")),
    tiempoInicio: opt(formData.get("tiempoInicio")),
    mejoriaMedicacion: opt(formData.get("mejoriaMedicacion")),
    alimentacion: opt(formData.get("alimentacion")),
    controlEsfinteres: opt(formData.get("controlEsfinteres")),
    sueno: opt(formData.get("sueno")),
    autonomiaPersonal: opt(formData.get("autonomiaPersonal")),
    reaccionRechazo: formData.get("reaccionRechazo") === "on",
    reaccionIndiferencia: formData.get("reaccionIndiferencia") === "on",
    reaccionAceptacion: formData.get("reaccionAceptacion") === "on",
    reaccionPreocupacion: formData.get("reaccionPreocupacion") === "on",
    reaccionVerguenza: formData.get("reaccionVerguenza") === "on",
    reaccionDetalle: opt(formData.get("reaccionDetalle")),
    creencias: opt(formData.get("creencias")),
    cambiosCrianza: opt(formData.get("cambiosCrianza")),
    usoCastigo: opt(formData.get("usoCastigo")),
    comportamientoApego: opt(formData.get("comportamientoApego")),
    enfermedadesFamiliares: opt(formData.get("enfermedadesFamiliares")),
    caracterPadres: opt(formData.get("caracterPadres")),
    observacionesEntrevista: opt(formData.get("observacionesEntrevista")),
  });
}

/**
 * Lee del FormData la tabla de familiares: cada fila del formulario envía los
 * campos fam_parentesco, fam_nombres, fam_edad, fam_ocupacion y fam_relacion
 * (getAll los devuelve alineados por índice de fila).
 */
function parseFamiliares(formData: FormData): Familiar[] {
  const parentescos = formData.getAll("fam_parentesco");
  const nombres = formData.getAll("fam_nombres");
  const edades = formData.getAll("fam_edad");
  const ocupaciones = formData.getAll("fam_ocupacion");
  const relaciones = formData.getAll("fam_relacion");

  const filas = [];
  for (let i = 0; i < parentescos.length; i++) {
    filas.push({
      parentesco: String(parentescos[i] ?? ""),
      nombres: String(nombres[i] ?? ""),
      edad: String(edades[i] ?? ""),
      ocupacion: String(ocupaciones[i] ?? ""),
      relacion: String(relaciones[i] ?? ""),
    });
  }
  return normalizarFamiliares(filas);
}

function historiaData(
  d: z.infer<typeof historiaSchema>,
  familiares: Familiar[],
) {
  return {
    fecha: new Date(d.fecha),
    lugarNacimiento: d.lugarNacimiento ?? null,
    padreApoderado: d.padreApoderado ?? null,
    familiares,
    historiaPrePostnatal: d.historiaPrePostnatal ?? null,
    presentacionDificultad: d.presentacionDificultad ?? null,
    signosSintomas: d.signosSintomas ?? null,
    tempranaCentro: d.tempranaCentro ?? null,
    tempranaAdaptacion: d.tempranaAdaptacion ?? null,
    kinderCentro: d.kinderCentro ?? null,
    kinderAdaptacion: d.kinderAdaptacion ?? null,
    evolucionMejoria: d.evolucionMejoria ?? null,
    examenesRealizados: d.examenesRealizados ?? null,
    tratamientosRecibidos: d.tratamientosRecibidos ?? null,
    indicacionesDoctor: d.indicacionesDoctor ?? null,
    medicinasRecomendadas: d.medicinasRecomendadas ?? null,
    dosis: d.dosis ?? null,
    tiempoInicio: d.tiempoInicio ?? null,
    mejoriaMedicacion: d.mejoriaMedicacion ?? null,
    alimentacion: d.alimentacion ?? null,
    controlEsfinteres: d.controlEsfinteres ?? null,
    sueno: d.sueno ?? null,
    autonomiaPersonal: d.autonomiaPersonal ?? null,
    reaccionRechazo: d.reaccionRechazo,
    reaccionIndiferencia: d.reaccionIndiferencia,
    reaccionAceptacion: d.reaccionAceptacion,
    reaccionPreocupacion: d.reaccionPreocupacion,
    reaccionVerguenza: d.reaccionVerguenza,
    reaccionDetalle: d.reaccionDetalle ?? null,
    creencias: d.creencias ?? null,
    cambiosCrianza: d.cambiosCrianza ?? null,
    usoCastigo: d.usoCastigo ?? null,
    comportamientoApego: d.comportamientoApego ?? null,
    enfermedadesFamiliares: d.enfermedadesFamiliares ?? null,
    caracterPadres: d.caracterPadres ?? null,
    observacionesEntrevista: d.observacionesEntrevista ?? null,
  };
}

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
  assertSedeAccess(user, paciente.sedeId);
  if (paciente.historiaClinica) {
    return { error: "Este paciente ya tiene una historia clínica registrada." };
  }

  const parsed = parseHistoriaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  await prisma.historiaClinica.create({
    data: {
      sedeId: paciente.sedeId,
      pacienteId,
      ...historiaData(parsed.data, parseFamiliares(formData)),
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
    select: { sedeId: true, pacienteId: true },
  });
  if (!existente) return { error: "La historia clínica no existe." };
  assertSedeAccess(user, existente.sedeId);

  const parsed = parseHistoriaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  await prisma.historiaClinica.update({
    where: { id: historiaId },
    data: historiaData(parsed.data, parseFamiliares(formData)),
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
  assertSedeAccess(user, existente.sedeId);

  await prisma.historiaClinica.delete({ where: { id: historiaId } });

  revalidatePath(`/pacientes/${existente.pacienteId}`);
  redirect(`/pacientes/${existente.pacienteId}`);
}
