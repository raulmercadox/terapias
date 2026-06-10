import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { ProgramaForm } from "./programa-form";

export default async function ProgramasPage({
  searchParams,
}: PageProps<"/configuracion/programas">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const { editar } = await searchParams;
  const editarId = typeof editar === "string" ? editar : undefined;

  const [programas, sedes] = await Promise.all([
    prisma.programaTerapia.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: { sede: { select: { nombre: true } } },
    }),
    prisma.sede.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const programaEnEdicion = editarId
    ? programas.find((p) => p.id === editarId)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programas"
        subtitle="Programas de terapia por sede y la duración de sus sesiones."
      />

      {sedes.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No hay sedes activas. Crea una sede antes de registrar programas.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {programas.length === 0 ? (
            <EmptyState message="No hay programas registrados." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Sede</Th>
                  <Th>Duración sesión</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programas.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-medium text-slate-900">{p.nombre}</Td>
                    <Td>{p.sede.nombre}</Td>
                    <Td>{p.duracionMin} min</Td>
                    <Td>
                      {p.activo ? (
                        <Badge color="green">Activo</Badge>
                      ) : (
                        <Badge color="red">Inactivo</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <ButtonLink
                        href={`/configuracion/programas?editar=${p.id}`}
                        variant="ghost"
                      >
                        Editar
                      </ButtonLink>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        <div>
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {programaEnEdicion ? "Editar programa" : "Nuevo programa"}
            </h2>
            <ProgramaForm
              key={programaEnEdicion?.id ?? "nuevo"}
              sedes={sedes}
              programa={
                programaEnEdicion
                  ? {
                      id: programaEnEdicion.id,
                      sedeId: programaEnEdicion.sedeId,
                      nombre: programaEnEdicion.nombre,
                      duracionMin: programaEnEdicion.duracionMin,
                      activo: programaEnEdicion.activo,
                    }
                  : undefined
              }
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
