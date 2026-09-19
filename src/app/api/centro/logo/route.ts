import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Logo del centro del usuario en sesión. Va aparte de getCentro para no cargar
// la imagen (hasta ~600 KB en base64) en cada página; la URL lleva ?v= con la
// fecha de subida, así que se puede cachear sin miedo a servir uno viejo.
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.centroId) return new Response(null, { status: 401 });

  const centro = await prisma.centro.findUnique({
    where: { id: user.centroId },
    select: { logoBase64: true },
  });
  const coincide = centro?.logoBase64 && /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(centro.logoBase64);
  if (!coincide) return new Response(null, { status: 404 });

  return new Response(Buffer.from(coincide[2], "base64"), {
    headers: {
      "Content-Type": coincide[1],
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
