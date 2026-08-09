import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto, edad, fechaInput } from "@/lib/utils";
import { InformeForm } from "../informe-form";
import { crearInforme } from "../actions";

export default async function NuevoInformePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const paciente = await prisma.paciente.findUnique({
    where: { id },
    select: {
      id: true,
      sedeId: true,
      nombres: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
      fechaNacimiento: true,
    },
  });
  if (!paciente || !canAccessSede(user, paciente.sedeId)) notFound();

  const terapeutas = await prisma.terapeuta.findMany({
    where: { sedeId: paciente.sedeId, activo: true },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, nombres: true, apellidos: true },
  });

  const accion = crearInforme.bind(null, paciente.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo informe de avance"
        subtitle={`${nombreCompleto(paciente)} · ${edad(paciente.fechaNacimiento)}`}
      />
      <div className="max-w-4xl">
        <InformeForm
          action={accion}
          terapeutas={terapeutas.map((t) => ({
            id: t.id,
            nombre: `${t.nombres} ${t.apellidos}`.trim(),
          }))}
          inicial={{ fecha: fechaInput(new Date()) }}
          cancelarHref={`/pacientes/${paciente.id}`}
        />
      </div>
    </div>
  );
}
