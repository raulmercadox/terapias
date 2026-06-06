import Link from "next/link";
import { requireUser, requireActiveSede } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  ButtonLink,
  EmptyState,
  Badge,
  Table,
  Th,
  Td,
} from "@/components/ui";
import { nombreCompleto, edad } from "@/lib/utils";

const PROGRAMA_LABEL: Record<string, string> = {
  ESCOLAR: "Escolar",
  INTERDIARIO: "Terapias Grupales",
  TERAPIAS: "Terapia Individual",
};

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  const { q } = await searchParams;
  const termino = (q ?? "").trim();

  const pacientes = await prisma.paciente.findMany({
    where: {
      sedeId,
      ...(termino
        ? {
            OR: [
              { nombres: { contains: termino, mode: "insensitive" } },
              { apellidoPaterno: { contains: termino, mode: "insensitive" } },
              { apellidoMaterno: { contains: termino, mode: "insensitive" } },
              { dni: { contains: termino, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
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
            {pacientes.map((p) => (
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
                <Td>{PROGRAMA_LABEL[p.programa] ?? p.programa}</Td>
                <Td>
                  {p.estado === "ACTIVO" ? (
                    <Badge color="green">ACTIVO</Badge>
                  ) : (
                    <Badge color="red">BAJA</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
