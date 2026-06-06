import { requireUser, requireActiveSede } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { nombreCompleto } from "@/lib/utils";
import { CitaForm } from "../cita-form";
import { parseFechaISO, aISO } from "../helpers";

export default async function NuevaCitaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  const { fecha: fechaParam } = await searchParams;

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

  const fechaDefecto =
    aISO(parseFechaISO(fechaParam) ?? new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva cita"
        subtitle="Agenda una consulta, evaluación o sesión."
      />
      <Card className="max-w-2xl">
        <CitaForm
          pacientes={pacientes.map((p) => ({
            id: p.id,
            nombre: nombreCompleto(p),
          }))}
          terapeutas={terapeutas.map((t) => ({
            id: t.id,
            nombre: `${t.apellidos} ${t.nombres}`,
          }))}
          fechaPorDefecto={fechaDefecto}
        />
      </Card>
    </div>
  );
}
