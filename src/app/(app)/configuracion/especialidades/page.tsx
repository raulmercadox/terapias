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
import { EspecialidadForm } from "./especialidad-form";

export default async function EspecialidadesPage({
  searchParams,
}: PageProps<"/configuracion/especialidades">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const { editar } = await searchParams;
  const editarId = typeof editar === "string" ? editar : undefined;

  const especialidades = await prisma.especialidad.findMany({
    where: { centroId: user.centroId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: { _count: { select: { terapeutas: true } } },
  });

  const especialidadEnEdicion = editarId
    ? especialidades.find((e) => e.id === editarId)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Especialidades"
        subtitle="Catálogo de especialidades que se asignan a los terapeutas."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {especialidades.length === 0 ? (
            <EmptyState message="No hay especialidades registradas." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Terapeutas</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {especialidades.map((e) => (
                  <tr key={e.id}>
                    <Td className="font-medium text-slate-900">{e.nombre}</Td>
                    <Td>{e._count.terapeutas}</Td>
                    <Td>
                      {e.activo ? (
                        <Badge color="green">Activa</Badge>
                      ) : (
                        <Badge color="red">Inactiva</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <ButtonLink
                        href={`/configuracion/especialidades?editar=${e.id}`}
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
              {especialidadEnEdicion
                ? "Editar especialidad"
                : "Nueva especialidad"}
            </h2>
            <EspecialidadForm
              key={especialidadEnEdicion?.id ?? "nueva"}
              especialidad={
                especialidadEnEdicion
                  ? {
                      id: especialidadEnEdicion.id,
                      nombre: especialidadEnEdicion.nombre,
                      activo: especialidadEnEdicion.activo,
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
