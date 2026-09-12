import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto, edad, hoyLima } from "@/lib/utils";
import { EvaluacionForm } from "../evaluacion-form";
import { crearEvaluacion } from "../actions";

export default async function NuevaEvaluacionPage({
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
      diagnostico: true,
    },
  });
  if (!paciente || !(await canAccessSede(user, paciente.sedeId))) notFound();

  const terapeutas = await prisma.terapeuta.findMany({
    where: { sedeId: paciente.sedeId, activo: true },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, nombres: true, apellidos: true },
  });

  const accion = crearEvaluacion.bind(null, paciente.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva ficha de evaluación"
        subtitle={`${nombreCompleto(paciente)} · ${edad(paciente.fechaNacimiento)}`}
      />
      <div className="max-w-4xl">
        <EvaluacionForm
          action={accion}
          terapeutas={terapeutas.map((t) => ({
            id: t.id,
            nombre: `${t.nombres} ${t.apellidos}`.trim(),
          }))}
          inicial={{
            fecha: hoyLima(),
            // Precarga el Dx registrado en la ficha del paciente, si existe.
            diagnostico: paciente.diagnostico,
          }}
          cancelarHref={`/pacientes/${paciente.id}`}
        />
      </div>
    </div>
  );
}
