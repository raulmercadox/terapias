import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireActiveSede, puedeVerPagos } from "@/lib/session";
import { filtrosDePagos } from "../filtros";
import { generarExcelPagos, nombreArchivo } from "../excel";

/** Descarga en Excel los pagos de /pagos con los mismos filtros de la URL. */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  // Igual que la página: el rol USUARIO no ve pagos.
  if (!puedeVerPagos(user)) return new Response("No encontrado", { status: 404 });
  // La sede activa ya está validada contra el centro del usuario.
  const sedeId = await requireActiveSede(user);

  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const { where, periodoArchivo } = await filtrosDePagos(sp, sedeId);

  const [sede, pagos] = await Promise.all([
    prisma.sede.findUnique({ where: { id: sedeId }, select: { nombre: true } }),
    prisma.pago.findMany({
      where,
      orderBy: { fechaPago: "asc" },
      select: {
        numeroRecibo: true,
        fechaPago: true,
        concepto: true,
        metodoPago: true,
        monto: true,
        saldo: true,
        paciente: {
          select: {
            nombres: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            dni: true,
          },
        },
      },
    }),
  ]);

  const buffer = await generarExcelPagos(
    pagos.map((p) => ({ ...p, monto: Number(p.monto), saldo: Number(p.saldo) })),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo(sede?.nombre ?? "", periodoArchivo)}"`,
      "Cache-Control": "no-store",
    },
  });
}
