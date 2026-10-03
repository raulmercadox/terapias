"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, terapeutaDe } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { validarFirmaPng } from "@/lib/firma";

export type FirmaState = { error?: string } | undefined;

/** Guarda la firma del terapeuta de la sesión (nunca de otro: el id no viaja en el form). */
export async function guardarMiFirma(
  _prev: FirmaState,
  formData: FormData,
): Promise<FirmaState> {
  const user = await requireUser();
  const { terapeutaId, tieneFirma } = terapeutaDe(user);

  const r = validarFirmaPng(String(formData.get("firma") ?? ""));
  if (!r.ok) return { error: r.error };

  await prisma.terapeuta.update({
    where: { id: terapeutaId },
    data: { firma: r.dataUrl, firmaActualizadaEn: new Date() },
  });

  // El aviso de "registra tu firma" vive en el layout.
  revalidatePath("/", "layout");
  // La primera vez se sigue al inicio; al cambiarla, se queda aquí.
  redirect(tieneFirma ? "/mi-firma?guardada=1" : "/panel");
}
