import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requireUser, requireActiveSede, puedeVerPagos } from "@/lib/session";
import {
  PageHeader,
  Card,
  EmptyState,
  ButtonLink,
  Table,
  Th,
  Td,
  Paginacion,
} from "@/components/ui";
import { soles, fecha, nombreCompleto } from "@/lib/utils";
import { CONCEPTO_LABEL, METODO_LABEL } from "./etiquetas";
import { filtrosDePagos, type ParamsPagos } from "./filtros";
import { cobranzaDeSede } from "./consultas-cobranza";

const POR_PAGINA = 20;

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<ParamsPagos & { pagina?: string }>;
}) {
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();
  const sedeId = await requireActiveSede(user);
  const sp = await searchParams;
  const { where, termino, pacienteFiltrado, mes, usaRango, etiquetaPeriodo } =
    await filtrosDePagos(sp, sedeId);

  // Total y suma del periodo completo (no solo de la página visible).
  const [totalRegistros, agregado, cobranza] = await Promise.all([
    prisma.pago.count({ where }),
    prisma.pago.aggregate({ where, _sum: { monto: true } }),
    cobranzaDeSede(sedeId, user.centroId),
  ]);
  const vencidos = cobranza.vencidos.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / POR_PAGINA));
  const paginaPedida = Number.parseInt(sp.pagina ?? "1", 10);
  const pagina = Number.isNaN(paginaPedida)
    ? 1
    : Math.min(Math.max(1, paginaPedida), totalPaginas);

  const pagos = await prisma.pago.findMany({
    where,
    orderBy: { fechaPago: "desc" },
    skip: (pagina - 1) * POR_PAGINA,
    take: POR_PAGINA,
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

  const total = Number(agregado._sum.monto ?? 0);

  // Query params a conservar al cambiar de página (y al descargar el Excel).
  const paramsPaginacion: Record<string, string> = {};
  if (pacienteFiltrado) paramsPaginacion.pacienteId = pacienteFiltrado.id;
  else if (termino) paramsPaginacion.q = termino;
  if (sp.mes) paramsPaginacion.mes = sp.mes;
  if (sp.desde) paramsPaginacion.desde = sp.desde;
  if (sp.hasta) paramsPaginacion.hasta = sp.hasta;
  const qsExportar = new URLSearchParams(paramsPaginacion).toString();

  return (
    <>
      <PageHeader
        title="Pagos"
        subtitle={`Recibos internos — ${etiquetaPeriodo}`}
        actions={
          <>
            {totalRegistros > 0 && (
              // <a> y no <Link>: es una descarga, no una navegación.
              <a
                href={`/pagos/exportar${qsExportar ? `?${qsExportar}` : ""}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Descargar Excel
              </a>
            )}
            <ButtonLink href="/pagos/cobranza" variant="secondary">
              Cobranza
              {vencidos > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {vencidos} vencido{vencidos === 1 ? "" : "s"}
                </span>
              )}
            </ButtonLink>
            <ButtonLink href="/pagos/nuevo" variant="primary">
              Registrar pago
            </ButtonLink>
          </>
        }
      />

      {pacienteFiltrado && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          <span>
            Mostrando los pagos de{" "}
            <span className="font-semibold">
              {nombreCompleto(pacienteFiltrado)}
            </span>
          </span>
          <Link
            href="/pagos"
            className="font-medium text-sky-600 hover:text-sky-700"
          >
            Quitar filtro
          </Link>
        </div>
      )}

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          {pacienteFiltrado ? (
            // Conserva el paciente al cambiar de mes o rango.
            <input type="hidden" name="pacienteId" value={pacienteFiltrado.id} />
          ) : (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Paciente
              </span>
              <input
                type="search"
                name="q"
                defaultValue={termino}
                placeholder="Buscar por nombre o DNI…"
                className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Mes</span>
            <input
              type="month"
              name="mes"
              defaultValue={usaRango || etiquetaPeriodo === "Todo el historial" ? "" : mes}
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
        <EmptyState
          message={
            pacienteFiltrado
              ? `${nombreCompleto(pacienteFiltrado)} no tiene pagos registrados en este periodo.`
              : termino
                ? `No se encontraron pagos de "${termino}" en este periodo. Prueba ampliar el rango de fechas.`
                : "No hay pagos registrados en este periodo."
          }
        />
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
            {totalRegistros} pago(s) · Total cobrado: {soles(total)}
          </p>
          <Paginacion
            pagina={pagina}
            totalPaginas={totalPaginas}
            total={totalRegistros}
            hrefBase="/pagos"
            params={paramsPaginacion}
          />
        </>
      )}
    </>
  );
}
