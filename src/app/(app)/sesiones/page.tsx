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
import { cn, soles, fecha, nombreCompleto, hoyLima } from "@/lib/utils";
import { estadoPaqueteColor, estadoPaqueteLabel } from "./ui";
import { claveFecha } from "./horario";
import {
  DIAS_AVISO,
  VENCIMIENTO_COLOR,
  estadoVencimiento,
  paquetesRenovados,
  textoVencimiento,
  type EstadoVencimiento,
} from "./vencimiento";

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

  const selectPaciente = {
    select: { nombres: true, apellidoPaterno: true, apellidoMaterno: true },
  };
  // Sesiones "usadas" = citas SESION con asistencia != PENDIENTE.
  const countUsadas = {
    select: {
      citas: { where: { tipo: "SESION" as const, asistencia: { not: "PENDIENTE" as const } } },
    },
  };

  const [paquetes, activos] = await Promise.all([
    prisma.paquete.findMany({
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
        paciente: selectPaciente,
        _count: countUsadas,
      },
    }),
    // Todos los activos (sin paginar) para el bloque "Por renovar".
    prisma.paquete.findMany({
      where: { ...where, estado: "ACTIVO" },
      select: {
        id: true,
        pacienteId: true,
        createdAt: true,
        totalSesiones: true,
        fechaFin: true,
        paciente: selectPaciente,
        _count: countUsadas,
      },
    }),
  ]);

  // Fin real = última sesión no cancelada: reprogramar no actualiza fechaFin.
  const ids = [...new Set([...activos, ...paquetes].map((p) => p.id))];
  const ultimas =
    ids.length > 0
      ? await prisma.cita.groupBy({
          by: ["paqueteId"],
          where: { paqueteId: { in: ids }, tipo: "SESION", estado: { not: "CANCELADA" } },
          _max: { fecha: true },
        })
      : [];
  const ultimaSesion = new Map(ultimas.map((u) => [u.paqueteId, u._max.fecha]));
  const finReal = (p: { id: string; fechaFin: Date | null }) =>
    ultimaSesion.get(p.id) ?? p.fechaFin;

  const hoy = hoyLima();
  const renovados = paquetesRenovados(activos);
  const vencimientos = new Map<string, EstadoVencimiento>();
  const porRenovar = activos
    .filter((p) => !renovados.has(p.id))
    .map((p) => {
      const fin = finReal(p);
      const finISO = fin ? claveFecha(fin) : null;
      const restantes = Math.max(0, p.totalSesiones - p._count.citas);
      const estado = estadoVencimiento({ finReal: finISO, restantes, hoy });
      if (estado) vencimientos.set(p.id, estado);
      return { ...p, finISO, restantes, estado };
    })
    .filter((p) => p.estado !== null)
    // Primero los que ya terminaron; dentro de cada grupo, el que termina antes.
    .sort(
      (a, b) =>
        Number(b.estado === "terminado") - Number(a.estado === "terminado") ||
        (a.finISO ?? "").localeCompare(b.finISO ?? ""),
    );

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

      {porRenovar.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            Por renovar ({porRenovar.length})
          </h2>
          <p className="text-xs text-amber-800">
            Paquetes activos que ya terminaron o terminan en los próximos {DIAS_AVISO} días.
          </p>
          <ul className="mt-3 divide-y divide-amber-100">
            {porRenovar.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    p.estado === "terminado" ? "bg-red-500" : "bg-amber-500",
                  )}
                />
                <span className="font-medium text-slate-900">
                  {nombreCompleto(p.paciente)}
                </span>
                <Badge color={VENCIMIENTO_COLOR[p.estado!]}>
                  {textoVencimiento(p.estado!, p.finISO, hoy)}
                </Badge>
                <span className="text-slate-600">
                  {p.restantes}{" "}
                  {p.restantes === 1 ? "sesión restante" : "sesiones restantes"}
                </span>
                <Link
                  href={`/sesiones/${p.id}`}
                  className="ml-auto font-medium text-sky-600 hover:text-sky-700"
                >
                  Ver
                </Link>
              </li>
            ))}
          </ul>
        </section>
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
              <Th>Vence</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paquetes.map((p) => {
              const usadas = p._count.citas;
              const restantes = Math.max(0, p.totalSesiones - usadas);
              const fin = finReal(p);
              const venc = vencimientos.get(p.id);
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
                  <Td>
                    {venc ? (
                      <Badge color={VENCIMIENTO_COLOR[venc]}>
                        {textoVencimiento(venc, fin ? claveFecha(fin) : null, hoy)}
                      </Badge>
                    ) : (
                      fecha(fin)
                    )}
                  </Td>
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
