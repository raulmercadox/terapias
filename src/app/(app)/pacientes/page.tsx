import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, requireActiveSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  ButtonLink,
  EmptyState,
  Badge,
  Table,
  Th,
  Td,
  Paginacion,
} from "@/components/ui";
import { nombreCompleto, edad } from "@/lib/utils";

const POR_PAGINA = 20;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();
  const sedeId = await requireActiveSede(user);
  const { q, pagina: paginaParam } = await searchParams;
  const termino = (q ?? "").trim();

  const where = {
    sedeId,
    ...(termino
      ? {
          OR: [
            { nombres: { contains: termino, mode: "insensitive" as const } },
            { apellidoPaterno: { contains: termino, mode: "insensitive" as const } },
            { apellidoMaterno: { contains: termino, mode: "insensitive" as const } },
            { dni: { contains: termino, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.paciente.count({ where });
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaPedida = Number.parseInt(paginaParam ?? "1", 10);
  const pagina = Number.isNaN(paginaPedida)
    ? 1
    : Math.min(Math.max(1, paginaPedida), totalPaginas);

  const pacientes = await prisma.paciente.findMany({
    where,
    orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
    skip: (pagina - 1) * POR_PAGINA,
    take: POR_PAGINA,
    include: {
      // Programas de los paquetes ACTIVOS del paciente (puede tener varios).
      paquetes: {
        where: { estado: "ACTIVO" },
        select: { programa: { select: { nombre: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pacientes"
        subtitle="Niños registrados en la sede activa"
        actions={
          <ButtonLink href="/pacientes/nuevo">Registrar nuevo</ButtonLink>
        }
      />

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={termino}
          placeholder="Buscar por nombre o DNI..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Buscar
        </button>
      </form>

      {pacientes.length === 0 ? (
        <EmptyState
          message={
            termino
              ? `No se encontraron pacientes para "${termino}".`
              : "Aún no hay pacientes registrados en esta sede."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre completo</Th>
              <Th>Edad</Th>
              <Th>DNI</Th>
              <Th>Teléfono</Th>
              <Th>Programa</Th>
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pacientes.map((p) => {
              // Nombres únicos de los programas con paquete activo (los paquetes
              // antiguos sin programa asignado no aportan nombre).
              const programas = [
                ...new Set(
                  p.paquetes
                    .map((pq) => pq.programa?.nombre)
                    .filter((n): n is string => Boolean(n)),
                ),
              ];
              return (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td>
                  <Link
                    href={`/pacientes/${p.id}`}
                    className="font-medium text-sky-700 hover:underline"
                  >
                    {nombreCompleto(p)}
                  </Link>
                </Td>
                <Td>{edad(p.fechaNacimiento)}</Td>
                <Td>{p.dni ?? "—"}</Td>
                <Td>{p.telefono ?? "—"}</Td>
                <Td>
                  {programas.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {programas.map((nombre) => (
                        <Badge key={nombre} color="sky">
                          {nombre}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Td>
                <Td>
                  {p.estado === "ACTIVO" ? (
                    <Badge color="green">ACTIVO</Badge>
                  ) : (
                    <Badge color="red">BAJA</Badge>
                  )}
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
        hrefBase="/pacientes"
        params={termino ? { q: termino } : {}}
      />
    </div>
  );
}
