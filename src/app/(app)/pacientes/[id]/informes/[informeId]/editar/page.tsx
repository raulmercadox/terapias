import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto, fechaInput } from "@/lib/utils";
import { InformeForm } from "../../informe-form";
import { actualizarInforme } from "../../actions";
import { normalizarSecciones } from "../../informe";

export default async function EditarInformePage({
  params,
}: {
  params: Promise<{ id: string; informeId: string }>;
}) {
  const { id, informeId } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const informe = await prisma.informeAvance.findUnique({
    where: { id: informeId },
    include: {
      paciente: {
        select: {
          id: true,
          sedeId: true,
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      },
    },
  });
  if (!informe || informe.pacienteId !== id) notFound();
  if (!canAccessSede(user, informe.sedeId)) notFound();

  const terapeutas = await prisma.terapeuta.findMany({
    where: { sedeId: informe.sedeId, activo: true },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, nombres: true, apellidos: true },
  });

  const accion = actualizarInforme.bind(null, informe.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar informe de avance"
        subtitle={nombreCompleto(informe.paciente)}
      />
      <div className="max-w-4xl">
        <InformeForm
          action={accion}
          terapeutas={terapeutas.map((t) => ({
            id: t.id,
            nombre: `${t.nombres} ${t.apellidos}`.trim(),
          }))}
          inicial={{
            fecha: fechaInput(informe.fecha),
            evaluadorId: informe.evaluadorId,
            secciones: normalizarSecciones(informe.secciones),
            recomendaciones: informe.recomendaciones,
          }}
          cancelarHref={`/pacientes/${id}/informes/${informeId}`}
        />
      </div>
    </div>
  );
}
