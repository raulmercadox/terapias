import "server-only";
import type { ConceptoPago, MetodoPago } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Prefijo de sede: primeras 3 letras del nombre en mayúsculas (solo A-Z). */
function prefijoSede(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita marcas de acento (diacríticos)
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  const base = (limpio || "SED").slice(0, 3);
  return base.padEnd(3, "X"); // garantiza 3 caracteres
}

/** Extrae el número del último recibo con un prefijo dado, ej "SJL-000042" -> 42. */
function numeroDeRecibo(numeroRecibo: string, prefijo: string): number {
  const m = numeroRecibo.match(new RegExp(`^${prefijo}-(\\d+)$`));
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Crea un pago con su número de recibo correlativo por sede. Lo usan el
 * registro de pagos y el cobro rápido del terapeuta. Puede lanzar si dos
 * pagos simultáneos chocan en el @@unique([sedeId, numeroRecibo]).
 */
export async function crearPagoConRecibo(data: {
  sedeId: string;
  pacienteId: string;
  paqueteId?: string;
  concepto: ConceptoPago;
  descripcion?: string;
  monto: number;
  metodoPago: MetodoPago;
  referencia?: string;
  fechaPago: Date;
}): Promise<{ id: string; numeroRecibo: string }> {
  const { sedeId } = data;
  return prisma.$transaction(async (tx) => {
    const sede = await tx.sede.findUniqueOrThrow({
      where: { id: sedeId },
      select: { nombre: true },
    });
    const prefijo = prefijoSede(sede.nombre);

    // Último recibo de la sede con este prefijo (orden lexicográfico ==
    // numérico porque el padding es fijo a 6 dígitos).
    const ultimo = await tx.pago.findFirst({
      where: { sedeId, numeroRecibo: { startsWith: `${prefijo}-` } },
      orderBy: { numeroRecibo: "desc" },
      select: { numeroRecibo: true },
    });

    const siguiente = ultimo ? numeroDeRecibo(ultimo.numeroRecibo, prefijo) + 1 : 1;
    const numeroRecibo = `${prefijo}-${String(siguiente).padStart(6, "0")}`;

    // Saldo automático: si el pago se vincula a un paquete, es lo que queda por
    // pagar de su precio (precio − pagos previos − este monto), nunca < 0.
    // Sin paquete vinculado no hay total de referencia, por lo que el saldo es 0.
    let saldo = 0;
    if (data.paqueteId) {
      const [paq, agg] = await Promise.all([
        tx.paquete.findUnique({
          where: { id: data.paqueteId },
          select: { precio: true },
        }),
        tx.pago.aggregate({
          where: { paqueteId: data.paqueteId },
          _sum: { monto: true },
        }),
      ]);
      const precio = Number(paq?.precio ?? 0);
      const pagado = Number(agg._sum.monto ?? 0);
      saldo = Math.max(0, Math.round((precio - pagado - data.monto) * 100) / 100);
    }

    return tx.pago.create({
      data: {
        sedeId,
        pacienteId: data.pacienteId,
        paqueteId: data.paqueteId,
        numeroRecibo,
        concepto: data.concepto,
        descripcion: data.descripcion,
        monto: data.monto,
        saldo,
        metodoPago: data.metodoPago,
        referencia: data.referencia,
        fechaPago: data.fechaPago,
      },
      select: { id: true, numeroRecibo: true },
    });
  });
}
