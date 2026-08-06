import Link from "next/link";
import { requireUser, requireActiveSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  ButtonLink,
  EmptyState,
  Table,
  Th,
  Td,
  Badge,
  Paginacion,
} from "@/components/ui";
import { soles, fecha, nombreCompleto } from "@/lib/utils";
import { estadoPaqueteColor, estadoPaqueteLabel } from "./ui";

const POR_PAGINA = 20;

export default async function SesionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pacienteId?: string; pagina?: string }>;
}) {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  const { q, pacienteId, pagina: paginaParam } = await searchParams;
  const termino = (q ?? "").trim();
  // El rol USUARIO no ve montos (información de pagos).
  const veMontos = puedeVerPagos(user);

  // Filtro directo por paciente (llegando desde su ficha con ?pacienteId=).
  const pacienteFiltrado = pacienteId
    ? await prisma.paciente.findFirst({
        where: { id: pacienteId, sedeId },
        select: {
          id: true,
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      })
    : null;

  // Búsqueda por paciente (nombre, apellidos o DNI).
  const where = {
    sedeId,
    ...(pacienteFiltrado
      ? { pacienteId: pacienteFiltrado.id }
      : termino
        ? {
            paciente: {
              OR: [
                { nombres: { contains: termino, mode: "insensitive" as const } },
                { apellidoPaterno: { contains: termino, mode: "insensitive" as const } },
                { apellidoMaterno: { contains: termino, mode: "insensitive" as const } },
                { dni: { contains: termino, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
  };

  const total = await prisma.paquete.count({ where });
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaPedida = Number.parseInt(paginaParam ?? "1", 10);
  const pagina = Number.isNaN(paginaPedida)
    ? 1
    : Math.min(Math.max(1, paginaPedida), totalPaginas);

  const paquetes = await prisma.paquete.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (pagina - 1) * POR_PAGINA,
    take: POR_PAGINA,
    select: {
      id: true,
      totalSesiones: true,
      frecuenciaSemana: true,
      precio: true,
      fechaInicio: true,
      fechaFin: true,
      estado: true,
      paciente: {
        select: {
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      },
      // Sesiones "usadas" = citas SESION con asistencia != PENDIENTE.
      _count: {
        select: {
          citas: { where: { tipo: "SESION", asistencia: { not: "PENDIENTE" } } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paquetes de sesiones"
        subtitle="Terapias vendidas por paquetes para la sede activa."
        actions={<ButtonLink href="/sesiones/nuevo">Nuevo paquete</ButtonLink>}
      />

      {pacienteFiltrado ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          <span>
            Mostrando los paquetes de{" "}
            <span className="font-semibold">
              {nombreCompleto(pacienteFiltrado)}
            </span>
          </span>
          <Link
            href="/sesiones"
            className="font-medium text-sky-600 hover:text-sky-700"
          >
            Quitar filtro
          </Link>
        </div>
      ) : (
        <form method="get" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={termino}
            placeholder="Buscar paciente por nombre o DNI..."
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Buscar
          </button>
        </form>
      )}

      {paquetes.length === 0 ? (
        <EmptyState
          message={
            pacienteFiltrado
              ? `${nombreCompleto(pacienteFiltrado)} no tiene paquetes registrados en esta sede.`
              : termino
                ? `No se encontraron paquetes de pacientes que coincidan con "${termino}".`
                : "No hay paquetes registrados en esta sede. Cree el primero con “Nuevo paquete”."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Paciente</Th>
              <Th>Sesiones</Th>
              <Th>Restantes</Th>
              {veMontos && <Th>Precio</Th>}
              <Th>Inicio</Th>
              <Th>Fin</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paquetes.map((p) => {
              const usadas = p._count.citas;
              const restantes = Math.max(0, p.totalSesiones - usadas);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">
                    {nombreCompleto(p.paciente)}
                  </Td>
                  <Td>
                    {usadas} / {p.totalSesiones}
                    <span className="ml-1 text-xs text-slate-400">
                      ({p.frecuenciaSemana}×sem)
                    </span>
                  </Td>
                  <Td>{restantes}</Td>
                  {veMontos && <Td>{soles(p.precio)}</Td>}
                  <Td>{fecha(p.fechaInicio)}</Td>
                  <Td>{fecha(p.fechaFin)}</Td>
                  <Td>
                    <Badge color={estadoPaqueteColor[p.estado]}>
                      {estadoPaqueteLabel[p.estado]}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/sesiones/${p.id}`}
                      className="text-sm font-medium text-sky-600 hover:text-sky-700"
                    >
                      Ver
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Paginacion
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={total}
        hrefBase="/sesiones"
        params={
          pacienteFiltrado
            ? { pacienteId: pacienteFiltrado.id }
            : termino
              ? { q: termino }
              : {}
        }
      />
    </div>
  );
}
