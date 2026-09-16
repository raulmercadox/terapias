"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, assertSedeAccess, assertRolGestion } from "@/lib/session";
import {
  VALORES_INFORME,
  normalizarSecciones,
  type SeccionInforme,
} from "./informe";

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

const informeSchema = z.object({
  fecha: z.string().min(1, "La fecha del informe es obligatoria."),
  evaluadorId: z.string().optional(),
  recomendaciones: z.string().optional(),
});

function parseCampos(formData: FormData) {
  return informeSchema.safeParse({
    fecha: opt(formData.get("fecha")) ?? "",
    evaluadorId: opt(formData.get("evaluadorId")),
    recomendaciones: opt(formData.get("recomendaciones")),
  });
}

/**
 * Reconstruye las secciones desde el FormData.
 *
 * Las secciones ya no salen de un catálogo fijo en el código: cada centro tiene
 * su plantilla y cada informe guarda la suya, así que las manda el propio
 * formulario en `seccion_id` / `seccion_titulo`. Dentro de cada sección, los
 * ítems viajan como tres campos paralelos alineados por índice:
 *   item_id_<seccionId>, item_label_<seccionId>, item_valor_<seccionId>
 *
 * El texto es editable, así que no se valida contra nada: lo que llega es la
 * fuente de verdad. Se descartan los ítems con el texto vacío (así se borra una
 * fila) y los valores fuera de EI/EP/LE.
 *
 * `item_valor_*` se envía siempre, incluso sin marcar, porque un grupo de
 * radios sin selección no aparece en el FormData y desalinearía los índices.
 */
function parseSecciones(formData: FormData): SeccionInforme[] {
  const ids = formData.getAll("seccion_id").map(String);
  const titulos = formData.getAll("seccion_titulo").map(String);

  const vistas = new Set<string>();
  const secciones = ids.flatMap((sid, k) => {
    // Una sección repetida haría que getAll mezclara los ítems de ambas.
    if (!sid || vistas.has(sid)) return [];
    vistas.add(sid);

    const itemIds = formData.getAll(`item_id_${sid}`);
    const labels = formData.getAll(`item_label_${sid}`);
    const valores = formData.getAll(`item_valor_${sid}`);

    const items = itemIds.flatMap((idBruto, i) => {
      const id = String(idBruto).trim();
      const label = String(labels[i] ?? "").trim();
      if (!id || !label) return [];
      const valor = String(valores[i] ?? "").trim();
      return [
        {
          id,
          label,
          valor: (VALORES_INFORME as readonly string[]).includes(valor)
            ? (valor as (typeof VALORES_INFORME)[number])
            : null,
        },
      ];
    });

    return [{ id: sid, titulo: titulos[k]?.trim() || sid, items }];
  });

  // Sanea y, sobre todo, desambigua ids repetidos dentro de una sección: dos
  // ítems distintos con el mismo id se confundirían en la analítica.
  return normalizarSecciones(secciones);
}

/** Valida que el evaluador (si se indicó) sea un terapeuta de la sede. */
async function validarEvaluador(
  evaluadorId: string | undefined,
  sedeId: string,
): Promise<string | null> {
  if (!evaluadorId) return null;
  const terapeuta = await prisma.terapeuta.findUnique({
    where: { id: evaluadorId },
    select: { sedeId: true },
  });
  if (!terapeuta || terapeuta.sedeId !== sedeId) {
    return "El profesional seleccionado no pertenece a la sede del paciente.";
  }
  return null;
}

const json = (v: unknown) => v as unknown as Prisma.InputJsonValue;

export async function crearInforme(
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

  const informe = await prisma.informeAvance.create({
    data: {
      sedeId: paciente.sedeId,
      pacienteId,
      evaluadorId: d.evaluadorId ?? null,
      fecha: new Date(d.fecha),
      secciones: json(parseSecciones(formData)),
      recomendaciones: d.recomendaciones ?? null,
    },
    select: { id: true },
  });

  revalidatePath(`/pacientes/${pacienteId}`);
  redirect(`/pacientes/${pacienteId}/informes/${informe.id}`);
}

export async function actualizarInforme(
  informeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  assertRolGestion(user);

  const existente = await prisma.informeAvance.findUnique({
    where: { id: informeId },
    select: { sedeId: true, pacienteId: true },
  });
  if (!existente) return { error: "El informe no existe." };
  await assertSedeAccess(user, existente.sedeId);

  const parsed = parseCampos(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }
  const d = parsed.data;

  const errorEvaluador = await validarEvaluador(d.evaluadorId, existente.sedeId);
  if (errorEvaluador) return { error: errorEvaluador };

  await prisma.informeAvance.update({
    where: { id: informeId },
    data: {
      evaluadorId: d.evaluadorId ?? null,
      fecha: new Date(d.fecha),
      secciones: json(parseSecciones(formData)),
      recomendaciones: d.recomendaciones ?? null,
    },
  });

  revalidatePath(`/pacientes/${existente.pacienteId}`);
  redirect(`/pacientes/${existente.pacienteId}/informes/${informeId}`);
}

/** Solo el administrador puede eliminar un informe de avance. */
export async function eliminarInforme(informeId: string) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") {
    throw new Error("No tiene permisos para esta operación.");
  }

  const existente = await prisma.informeAvance.findUnique({
    where: { id: informeId },
    select: { sedeId: true, pacienteId: true },
  });
  if (!existente) throw new Error("El informe no existe.");
  await assertSedeAccess(user, existente.sedeId);

  await prisma.informeAvance.delete({ where: { id: informeId } });

  revalidatePath(`/pacientes/${existente.pacienteId}`);
  redirect(`/pacientes/${existente.pacienteId}`);
}
