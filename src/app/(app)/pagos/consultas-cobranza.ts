// Paquetes con saldo pendiente y su estado de cobro. Lo usan la página de
// Cobranza, el botón de /pagos y la tarjeta de Inicio.
import "server-only";
import { prisma } from "@/lib/prisma";
import { hoyLima, nombreCompleto } from "@/lib/utils";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { claveFecha } from "../sesiones/horario";
import { normalizarTelefonoPe } from "../citas/helpers";
import {
  evaluarCobro,
  reglaDeConfiguracion,
  type EstadoCobro,
  type ReglaGracia,
} from "./cobranza";

export type FilaCobranza = {
  paqueteId: string;
  pacienteId: string;
  paciente: string;
  /** "Ana Pérez", para el saludo del mensaje. */
  pacienteCorto: string;
  telefono: string | null;
  whatsapp: string | null;
  totalSesiones: number;
  inicioISO: string;
  finISO: string;
  precio: number;
  pagado: number;
  saldo: number;
  limiteISO: string;
  estado: EstadoCobro;
};

/**
 * Cobranza de una sede. El `centroId` es el del usuario: el plazo de pago se
 * configura por centro, y la sede ya viene validada contra él.
 */
export async function cobranzaDeSede(
  sedeId: string,
  centroId: string,
): Promise<{
  regla: ReglaGracia;
  hoy: string;
  vencidos: FilaCobranza[];
  porVencer: FilaCobranza[];
}> {
  const [config, paquetes, pagados] = await Promise.all([
    obtenerConfiguracion(centroId),
    // Los completados que aún deben también se cobran; los anulados no.
    prisma.paquete.findMany({
      where: {
        sedeId,
        estado: { not: "ANULADO" },
        precio: { gt: 0 },
        fechaInicio: { not: null },
      },
      select: {
        id: true,
        pacienteId: true,
        totalSesiones: true,
        precio: true,
        fechaInicio: true,
        fechaFin: true,
        paciente: {
          select: {
            nombres: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
            telefono: true,
            apoderados: {
              select: { telefono: true },
              orderBy: { principal: "desc" },
            },
          },
        },
      },
    }),
    prisma.pago.groupBy({
      by: ["paqueteId"],
      where: { sedeId, paqueteId: { not: null } },
      _sum: { monto: true },
    }),
  ]);

  const regla = reglaDeConfiguracion(config);
  const hoy = hoyLima();
  const pagadoPor = new Map(pagados.map((g) => [g.paqueteId, Number(g._sum.monto ?? 0)]));

  const filas: FilaCobranza[] = [];
  for (const p of paquetes) {
    const inicioISO = claveFecha(p.fechaInicio!);
    const finISO = p.fechaFin ? claveFecha(p.fechaFin) : inicioISO;
    const precio = Number(p.precio);
    const pagado = pagadoPor.get(p.id) ?? 0;
    const { saldo, limiteISO, estado } = evaluarCobro(
      { precio, pagado, fechaInicio: inicioISO, fechaFin: finISO },
      regla,
      hoy,
    );
    if (!estado || !limiteISO) continue;
    // En terapia infantil suele contestar el apoderado: su teléfono va primero.
    const telefono =
      p.paciente.apoderados.find((a) => a.telefono)?.telefono ?? p.paciente.telefono ?? null;
    filas.push({
      paqueteId: p.id,
      pacienteId: p.pacienteId,
      paciente: nombreCompleto(p.paciente),
      pacienteCorto: `${p.paciente.nombres} ${p.paciente.apellidoPaterno}`,
      telefono,
      whatsapp: normalizarTelefonoPe(telefono),
      totalSesiones: p.totalSesiones,
      inicioISO,
      finISO,
      precio,
      pagado,
      saldo,
      limiteISO,
      estado,
    });
  }

  // Los dos grupos, del plazo más antiguo al más próximo (más atraso primero).
  filas.sort((a, b) => a.limiteISO.localeCompare(b.limiteISO));
  return {
    regla,
    hoy,
    vencidos: filas.filter((f) => f.estado === "vencido"),
    porVencer: filas.filter((f) => f.estado === "por-vencer"),
  };
}
