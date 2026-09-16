// Filtros de /pagos a partir de la URL. Los comparten la página y la descarga
// en Excel, para que el reporte tenga exactamente los pagos que se ven.
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ParamsPagos = {
  mes?: string;
  desde?: string;
  hasta?: string;
  q?: string;
  pacienteId?: string;
};

/** Devuelve "YYYY-MM" del mes actual. */
function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Rango [desde, hasta) a partir de un parámetro "YYYY-MM". */
function rangoDeMes(mes: string): { desde: Date; hasta: Date } | null {
  const m = mes.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const desde = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const hasta = new Date(year, month, 1, 0, 0, 0, 0);
  return { desde, hasta };
}

/** Inicio del día de un "YYYY-MM-DD" (o fin si esFin: día siguiente). */
function fechaParam(valor: string | undefined, esFin = false): Date | null {
  if (!valor) return null;
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  if (esFin) d.setDate(d.getDate() + 1); // exclusivo
  return d;
}

/** El `sedeId` ya viene validado por `requireActiveSede`: aísla el centro. */
export async function filtrosDePagos(sp: ParamsPagos, sedeId: string) {
  const termino = (sp.q ?? "").trim();

  // Filtro directo por paciente (llegando desde su ficha con ?pacienteId=).
  const pacienteFiltrado = sp.pacienteId
    ? await prisma.paciente.findFirst({
        where: { id: sp.pacienteId, sedeId },
        select: {
          id: true,
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      })
    : null;

  // Filtro: si hay desde/hasta toma prioridad el rango; si no, por mes.
  const desdeParam = fechaParam(sp.desde);
  const hastaParam = fechaParam(sp.hasta, true);
  const usaRango = Boolean(desdeParam || hastaParam);

  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesActual();
  const rango = rangoDeMes(mes);

  let fechaFilter: { gte?: Date; lt?: Date };
  let etiquetaPeriodo: string;
  let periodoArchivo: string;

  if (usaRango) {
    fechaFilter = {};
    if (desdeParam) fechaFilter.gte = desdeParam;
    if (hastaParam) fechaFilter.lt = hastaParam;
    etiquetaPeriodo = `Del ${sp.desde ?? "inicio"} al ${sp.hasta ?? "hoy"}`;
    periodoArchivo = `${sp.desde ?? "inicio"}_${sp.hasta ?? "hoy"}`;
  } else if (pacienteFiltrado && !sp.mes) {
    // Desde la ficha del paciente se muestra todo su historial de pagos.
    fechaFilter = {};
    etiquetaPeriodo = "Todo el historial";
    periodoArchivo = "historial";
  } else {
    fechaFilter = { gte: rango!.desde, lt: rango!.hasta };
    etiquetaPeriodo = new Intl.DateTimeFormat("es-PE", {
      month: "long",
      year: "numeric",
    }).format(rango!.desde);
    periodoArchivo = mes;
  }

  // Búsqueda por paciente (nombre, apellidos o DNI), insensible a mayúsculas.
  const pacienteFilter: Prisma.PagoWhereInput = pacienteFiltrado
    ? { pacienteId: pacienteFiltrado.id }
    : termino
      ? {
          paciente: {
            OR: [
              { nombres: { contains: termino, mode: "insensitive" } },
              { apellidoPaterno: { contains: termino, mode: "insensitive" } },
              { apellidoMaterno: { contains: termino, mode: "insensitive" } },
              { dni: { contains: termino, mode: "insensitive" } },
            ],
          },
        }
      : {};

  const where: Prisma.PagoWhereInput = {
    sedeId,
    fechaPago: fechaFilter,
    ...pacienteFilter,
  };

  return {
    where,
    termino,
    pacienteFiltrado,
    mes,
    usaRango,
    etiquetaPeriodo,
    periodoArchivo,
  };
}
