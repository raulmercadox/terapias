import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, requireActiveSede } from "@/lib/session";
import {
  PageHeader,
  Card,
  EmptyState,
  ButtonLink,
  Table,
  Th,
  Td,
} from "@/components/ui";
import { soles, fecha, nombreCompleto } from "@/lib/utils";

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

const CONCEPTO_LABEL: Record<string, string> = {
  MATRICULA: "Matrícula",
  MATERIALES: "Materiales",
  MENSUALIDAD: "Mensualidad",
  PAQUETE_SESIONES: "Paquete de sesiones",
  EVALUACION: "Evaluación",
  OTRO: "Otro",
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

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; desde?: string; hasta?: string }>;
}) {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  const sp = await searchParams;

  // Filtro: si hay desde/hasta toma prioridad el rango; si no, por mes.
  const desdeParam = fechaParam(sp.desde);
  const hastaParam = fechaParam(sp.hasta, true);
  const usaRango = Boolean(desdeParam || hastaParam);

  const mes = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesActual();
  const rango = rangoDeMes(mes);

  let fechaFilter: { gte?: Date; lt?: Date };
  let etiquetaPeriodo: string;

  if (usaRango) {
    fechaFilter = {};
    if (desdeParam) fechaFilter.gte = desdeParam;
    if (hastaParam) fechaFilter.lt = hastaParam;
    etiquetaPeriodo = `Del ${sp.desde ?? "inicio"} al ${sp.hasta ?? "hoy"}`;
  } else {
    fechaFilter = { gte: rango!.desde, lt: rango!.hasta };
    etiquetaPeriodo = new Intl.DateTimeFormat("es-PE", {
      month: "long",
      year: "numeric",
    }).format(rango!.desde);
  }

  const pagos = await prisma.pago.findMany({
    where: { sedeId, fechaPago: fechaFilter },
    orderBy: { fechaPago: "desc" },
    select: {
      id: true,
      numeroRecibo: true,
      fechaPago: true,
      concepto: true,
      descripcion: true,
      monto: true,
      saldo: true,
      metodoPago: true,
      paciente: {
        select: { nombres: true, apellidoPaterno: true, apellidoMaterno: true },
      },
    },
  });

  const total = pagos.reduce((acc, p) => acc + Number(p.monto), 0);

  return (
    <>
      <PageHeader
        title="Pagos"
        subtitle={`Recibos internos — ${etiquetaPeriodo}`}
        actions={
          <ButtonLink href="/pagos/nuevo" variant="primary">
            Registrar pago
          </ButtonLink>
        }
      />

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Mes</span>
            <input
              type="month"
              name="mes"
              defaultValue={usaRango ? "" : mes}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </label>
          <span className="pb-2 text-xs text-slate-400">o rango</span>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={sp.desde ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={sp.hasta ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
          >
            Filtrar
          </button>
          <Link
            href="/pagos"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Mes actual
          </Link>
        </form>
      </Card>

      {pagos.length === 0 ? (
        <EmptyState message="No hay pagos registrados en este periodo." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>N.º recibo</Th>
                <Th>Fecha</Th>
                <Th>Paciente</Th>
                <Th>Concepto</Th>
                <Th className="text-right">Monto</Th>
                <Th className="text-right">Saldo</Th>
                <Th>Método</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/pagos/${p.id}/recibo`}
                      className="font-medium text-sky-700 hover:underline"
                    >
                      {p.numeroRecibo}
                    </Link>
                  </Td>
                  <Td>{fecha(p.fechaPago)}</Td>
                  <Td>{nombreCompleto(p.paciente)}</Td>
                  <Td>
                    {CONCEPTO_LABEL[p.concepto] ?? p.concepto}
                    {p.descripcion ? (
                      <span className="block text-xs text-slate-400">
                        {p.descripcion}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-right font-medium">{soles(p.monto)}</Td>
                  <Td className="text-right">
                    {Number(p.saldo) > 0 ? (
                      <span className="text-amber-600">{soles(p.saldo)}</span>
                    ) : (
                      <span className="text-slate-400">{soles(0)}</span>
                    )}
                  </Td>
                  <Td>{METODO_LABEL[p.metodoPago] ?? p.metodoPago}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <Td className="font-semibold text-slate-900" />
                <Td />
                <Td />
                <Td className="text-right text-xs uppercase tracking-wide text-slate-500">
                  Total del periodo
                </Td>
                <Td className="text-right font-semibold text-slate-900">
                  {soles(total)}
                </Td>
                <Td />
                <Td />
              </tr>
            </tfoot>
          </Table>
          <p className="text-sm text-slate-500">
            {pagos.length} pago(s) · Total cobrado: {soles(total)}
          </p>
        </>
      )}
    </>
  );
}
