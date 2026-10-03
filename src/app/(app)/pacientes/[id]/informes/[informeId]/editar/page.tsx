import { notFound } from "next/navigation";
import {
  requireUser,
  canAccessSede,
  requireAccesoClinico,
  evaluadorFijoDe,
  esAutorClinico,
} from "@/lib/session";
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
  await requireAccesoClinico(user, id);

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
  if (!(await canAccessSede(user, informe.sedeId))) notFound();

  // El terapeuta solo edita lo que él registró.
  if (!esAutorClinico(user, informe.evaluadorId)) notFound();
  // Para el terapeuta, el evaluador es él mismo y no se puede cambiar.
  const evaluadorFijo = await evaluadorFijoDe(user);

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
          evaluadorFijo={evaluadorFijo}
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
