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
import { TerapiaForm } from "./terapia-form";

export default async function TerapiasPage({
  searchParams,
}: PageProps<"/configuracion/terapias">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const { editar } = await searchParams;
  const editarId = typeof editar === "string" ? editar : undefined;

  const [terapias, sedes, especialidades] = await Promise.all([
    prisma.terapia.findMany({
      where: { sede: { centroId: user.centroId } },
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: {
        sede: { select: { nombre: true } },
        especialidad: { select: { nombre: true } },
      },
    }),
    prisma.sede.findMany({
      where: { centroId: user.centroId, activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    prisma.especialidad.findMany({
      where: { centroId: user.centroId, activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const enEdicion = editarId ? terapias.find((t) => t.id === editarId) : undefined;
  // Al editar se ofrece también su especialidad si quedó inactiva.
  const opcionesEspecialidad =
    enEdicion?.especialidadId &&
    enEdicion.especialidad &&
    !especialidades.some((e) => e.id === enEdicion.especialidadId)
      ? [...especialidades, { id: enEdicion.especialidadId, nombre: enEdicion.especialidad.nombre }]
      : especialidades;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terapias"
        subtitle="Terapias de cada sede: especialidad, duración de la sesión y si son individuales o grupales."
      />

      {sedes.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No hay sedes activas. Crea una sede antes de registrar terapias.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {terapias.length === 0 ? (
            <EmptyState message="No hay terapias registradas." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Sede</Th>
                  <Th>Especialidad</Th>
                  <Th>Sesión</Th>
                  <Th>Modalidad</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terapias.map((t) => (
                  <tr key={t.id}>
                    <Td className="font-medium text-slate-900">{t.nombre}</Td>
                    <Td>{t.sede.nombre}</Td>
                    <Td>
                      {t.especialidad ? (
                        t.especialidad.nombre
                      ) : (
                        <Badge color="amber">Asignar especialidad</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{t.duracionMin} min</Td>
                    <Td>
                      {t.modalidad === "GRUPAL"
                        ? `Grupal · hasta ${t.maxParticipantes}`
                        : "Individual"}
                    </Td>
                    <Td>
                      {t.activo ? (
                        <Badge color="green">Activa</Badge>
                      ) : (
                        <Badge color="red">Inactiva</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <ButtonLink
                        href={`/configuracion/terapias?editar=${t.id}`}
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
              {enEdicion ? "Editar terapia" : "Nueva terapia"}
            </h2>
            <TerapiaForm
              key={enEdicion?.id ?? "nueva"}
              sedes={sedes}
              especialidades={opcionesEspecialidad}
              terapia={
                enEdicion
                  ? {
                      id: enEdicion.id,
                      sedeId: enEdicion.sedeId,
                      nombre: enEdicion.nombre,
                      especialidadId: enEdicion.especialidadId,
                      modalidad: enEdicion.modalidad,
                      duracionMin: enEdicion.duracionMin,
                      maxParticipantes: enEdicion.maxParticipantes,
                      activo: enEdicion.activo,
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
