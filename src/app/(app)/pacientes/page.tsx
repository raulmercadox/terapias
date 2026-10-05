import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireUser,
  requireActiveSede,
  puedeVerClinica,
  esTerapeuta,
  puede,
  whereMisPacientes,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  ButtonLink,
  EmptyState,
  Badge,
  Table,
  Th,
  Td,
  Select,
  Paginacion,
} from "@/components/ui";
import { nombreCompleto, edad, cn } from "@/lib/utils";
import {
  WHERE_ES_PACIENTE,
  WHERE_ES_POTENCIAL,
  type TipoPaciente,
} from "@/lib/tipo-paciente";
import type { Prisma } from "@prisma/client";

const POR_PAGINA = 20;

/** Valores del filtro de estado; TODOS no aplica condición. */
const ESTADOS = ["TODOS", "ACTIVO", "BAJA"] as const;
type FiltroEstado = (typeof ESTADOS)[number];

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; pagina?: string; tipo?: string }>;
}) {
  const user = await requireUser();
  if (!puedeVerClinica(user)) notFound();
  // El terapeuta ve solo los pacientes que atiende (o toda la sede con permiso).
  const terapeuta = esTerapeuta(user);
  const sedeId = await requireActiveSede(user);
  const {
    q,
    estado: estadoParam,
    pagina: paginaParam,
    tipo: tipoParam,
  } = await searchParams;
  // Pestaña: pacientes (ya en terapia) o potenciales (aún no empiezan).
  const tipo: TipoPaciente = tipoParam === "potenciales" ? "potenciales" : "pacientes";
  const termino = (q ?? "").trim();
  const estado: FiltroEstado = ESTADOS.includes(estadoParam as FiltroEstado)
    ? (estadoParam as FiltroEstado)
    : "TODOS";

  // Filtros comunes a ambas pestañas. Van en AND: la búsqueda usa `OR` y el
  // filtro del terapeuta usa `citas`, y un spread se pisaría con ellos.
  const filtros: Prisma.PacienteWhereInput[] = [
    whereMisPacientes(user),
    estado === "TODOS" ? {} : { estado },
    termino
      ? {
          OR: [
            { nombres: { contains: termino, mode: "insensitive" } },
            { apellidoPaterno: { contains: termino, mode: "insensitive" } },
            { apellidoMaterno: { contains: termino, mode: "insensitive" } },
            { dni: { contains: termino, mode: "insensitive" } },
          ],
        }
      : {},
  ];
  const whereDe = (t: TipoPaciente): Prisma.PacienteWhereInput => ({
    sedeId,
    AND: [...filtros, t === "pacientes" ? WHERE_ES_PACIENTE : WHERE_ES_POTENCIAL],
  });
  const where = whereDe(tipo);

  const [totalPacientes, totalPotenciales] = await Promise.all([
    prisma.paciente.count({ where: whereDe("pacientes") }),
    prisma.paciente.count({ where: whereDe("potenciales") }),
  ]);
  const total = tipo === "pacientes" ? totalPacientes : totalPotenciales;
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
      // Terapias de los paquetes ACTIVOS del paciente (puede tener varios).
      paquetes: {
        where: { estado: "ACTIVO" },
        select: { terapias: { select: { terapia: { select: { nombre: true } } } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={terapeuta ? "Mis pacientes" : "Pacientes"}
        subtitle={
          terapeuta && !puede(user, "VER_PACIENTES_SEDE")
            ? "Niños que atiendes en la sede"
            : "Niños registrados en la sede activa"
        }
        actions={
          !terapeuta && (
            <ButtonLink href="/pacientes/nuevo">Registrar nuevo</ButtonLink>
          )
        }
      />

      <div className="flex gap-1 border-b border-slate-200" role="tablist">
        {(
          [
            ["pacientes", "Pacientes", totalPacientes],
            ["potenciales", "Potenciales", totalPotenciales],
          ] as const
        ).map(([valor, etiqueta, n]) => {
          const params = new URLSearchParams({
            ...(valor === "potenciales" ? { tipo: valor } : {}),
            ...(termino ? { q: termino } : {}),
            ...(estado === "TODOS" ? {} : { estado }),
          }).toString();
          return (
            <Link
              key={valor}
              role="tab"
              aria-selected={tipo === valor}
              href={`/pacientes${params ? `?${params}` : ""}`}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium",
                tipo === valor
                  ? "border-sky-600 text-sky-700"
                  : "border-transparent text-slate-500 hover:text-slate-700",
              )}
            >
              {etiqueta} <span className="text-xs text-slate-400">({n})</span>
            </Link>
          );
        })}
      </div>
      {tipo === "potenciales" && (
        <p className="text-sm text-slate-500">
          Evaluados o registrados que aún no tienen un paquete agendado ni han
          asistido a una sesión.
        </p>
      )}

      <form method="get" className="flex flex-wrap gap-2">
        {tipo === "potenciales" && <input type="hidden" name="tipo" value={tipo} />}
        <input
          type="search"
          name="q"
          defaultValue={termino}
          placeholder="Buscar por nombre o DNI..."
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <div className="w-48">
          <Select name="estado" defaultValue={estado} aria-label="Filtrar por estado">
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVO">Solo activos</option>
            <option value="BAJA">Solo bajas</option>
          </Select>
        </div>
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
            tipo === "potenciales"
              ? termino
                ? `No se encontraron potenciales para "${termino}".`
                : "No hay potenciales en esta sede."
              : termino
              ? `No se encontraron pacientes para "${termino}"${
                  estado === "ACTIVO"
                    ? " entre los activos"
                    : estado === "BAJA"
                      ? " entre las bajas"
                      : ""
                }.`
              : estado === "ACTIVO"
                ? "No hay pacientes activos en esta sede."
                : estado === "BAJA"
                  ? "No hay pacientes dados de baja en esta sede."
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
              {tipo === "pacientes" && <Th>Terapias</Th>}
              <Th>Estado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pacientes.map((p) => {
              // Nombres únicos de las terapias con paquete activo (los paquetes
              // antiguos sin terapia asignada no aportan nombre).
              const programas = [
                ...new Set(
                  p.paquetes
                    .flatMap((pq) => pq.terapias.map((l) => l.terapia?.nombre))
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
                {tipo === "pacientes" && (
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
                )}
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
        params={{
          ...(termino ? { q: termino } : {}),
          ...(estado === "TODOS" ? {} : { estado }),
          ...(tipo === "potenciales" ? { tipo } : {}),
        }}
      />
    </div>
  );
}
