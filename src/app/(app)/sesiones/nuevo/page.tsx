import { requireUser, requireActiveSede } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, ButtonLink, Card, EmptyState } from "@/components/ui";
import { nombreCompleto } from "@/lib/utils";
import NuevoPaqueteForm from "./form";

export default async function NuevoPaquetePage() {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);

  const [pacientes, terapeutas] = await Promise.all([
    prisma.paciente.findMany({
      where: { sedeId, estado: "ACTIVO" },
      orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
      select: {
        id: true,
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
      },
    }),
    prisma.terapeuta.findMany({
      where: { sedeId, activo: true },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: { id: true, nombres: true, apellidos: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo paquete"
        subtitle="Se generarán automáticamente las sesiones según la frecuencia."
        actions={
          <ButtonLink href="/sesiones" variant="secondary">
            Volver
          </ButtonLink>
        }
      />

      {pacientes.length === 0 ? (
        <EmptyState message="No hay pacientes activos en esta sede. Registre un paciente antes de crear un paquete." />
      ) : (
        <Card className="max-w-2xl">
          <NuevoPaqueteForm
            sedeId={sedeId}
            pacientes={pacientes.map((p) => ({
              id: p.id,
              nombre: nombreCompleto(p),
            }))}
            terapeutas={terapeutas.map((t) => ({
              id: t.id,
              nombre: `${t.apellidos}, ${t.nombres}`,
            }))}
          />
        </Card>
      )}
    </div>
  );
}
