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
import { SedeForm } from "./sede-form";

export default async function SedesPage({
  searchParams,
}: PageProps<"/configuracion/sedes">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const { editar } = await searchParams;
  const editarId = typeof editar === "string" ? editar : undefined;

  const sedes = await prisma.sede.findMany({
    where: { centroId: user.centroId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });

  const sedeEnEdicion = editarId
    ? sedes.find((s) => s.id === editarId)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Sedes" subtitle="Locales del centro." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {sedes.length === 0 ? (
            <EmptyState message="No hay sedes registradas." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Dirección</Th>
                  <Th>Teléfono</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sedes.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-medium text-slate-900">{s.nombre}</Td>
                    <Td>{s.direccion ?? "—"}</Td>
                    <Td>{s.telefono ?? "—"}</Td>
                    <Td>
                      {s.activo ? (
                        <Badge color="green">Activa</Badge>
                      ) : (
                        <Badge color="red">Inactiva</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <ButtonLink
                        href={`/configuracion/sedes?editar=${s.id}`}
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
              {sedeEnEdicion ? "Editar sede" : "Nueva sede"}
            </h2>
            <SedeForm
              key={sedeEnEdicion?.id ?? "nueva"}
              sede={
                sedeEnEdicion
                  ? {
                      id: sedeEnEdicion.id,
                      nombre: sedeEnEdicion.nombre,
                      direccion: sedeEnEdicion.direccion,
                      telefono: sedeEnEdicion.telefono,
                      activo: sedeEnEdicion.activo,
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
