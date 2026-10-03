import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Imagen de fondo de un campo "marcas sobre imagen", solo para el centro que la
// subió. Es inmutable (otra imagen = otro id), así que se cachea sin miedo.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/fichas/imagen/[id]">) {
  const user = await getCurrentUser();
  if (!user?.centroId) return new Response(null, { status: 401 });

  const { id } = await ctx.params;
  const imagen = await prisma.imagenFicha.findFirst({
    where: { id, centroId: user.centroId },
    select: { tipo: true, datos: true },
  });
  if (!imagen) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(imagen.datos), {
    headers: {
      "Content-Type": imagen.tipo,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
