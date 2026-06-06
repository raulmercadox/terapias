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
import { TerapeutaForm } from "./terapeuta-form";

export default async function TerapeutasPage({
  searchParams,
}: PageProps<"/configuracion/terapeutas">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const { editar } = await searchParams;
  const editarId = typeof editar === "string" ? editar : undefined;

  const [terapeutas, sedes] = await Promise.all([
    prisma.terapeuta.findMany({
      orderBy: [{ activo: "desc" }, { apellidos: "asc" }],
      include: { sede: { select: { nombre: true } } },
    }),
    prisma.sede.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const terapeutaEnEdicion = editarId
    ? terapeutas.find((t) => t.id === editarId)
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terapeutas"
        subtitle="Profesionales que atienden en cada sede."
      />

      {sedes.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No hay sedes activas. Crea una sede antes de registrar terapeutas.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {terapeutas.length === 0 ? (
            <EmptyState message="No hay terapeutas registrados." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Sede</Th>
                  <Th>Especialidad</Th>
                  <Th>Teléfono</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terapeutas.map((t) => (
                  <tr key={t.id}>
                    <Td className="font-medium text-slate-900">
                      {t.apellidos}, {t.nombres}
                    </Td>
                    <Td>{t.sede.nombre}</Td>
                    <Td>{t.especialidad ?? "—"}</Td>
                    <Td>{t.telefono ?? "—"}</Td>
                    <Td>
                      {t.activo ? (
                        <Badge color="green">Activo</Badge>
                      ) : (
                        <Badge color="red">Inactivo</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <ButtonLink
                        href={`/configuracion/terapeutas?editar=${t.id}`}
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
              {terapeutaEnEdicion ? "Editar terapeuta" : "Nuevo terapeuta"}
            </h2>
            <TerapeutaForm
              key={terapeutaEnEdicion?.id ?? "nuevo"}
              sedes={sedes}
              terapeuta={
                terapeutaEnEdicion
                  ? {
                      id: terapeutaEnEdicion.id,
                      sedeId: terapeutaEnEdicion.sedeId,
                      nombres: terapeutaEnEdicion.nombres,
                      apellidos: terapeutaEnEdicion.apellidos,
                      especialidad: terapeutaEnEdicion.especialidad,
                      telefono: terapeutaEnEdicion.telefono,
                      activo: terapeutaEnEdicion.activo,
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
