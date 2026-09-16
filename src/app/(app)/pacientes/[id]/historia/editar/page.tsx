import { notFound, redirect } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto, fechaInput } from "@/lib/utils";
import { obtenerPlantilla } from "@/lib/plantillas";
import { normalizarValores } from "@/lib/fichas/valores";
import { FichaForm } from "@/components/ficha/ficha-form";
import { actualizarHistoria } from "../actions";

export default async function EditarHistoriaPage({
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
      historiaClinica: { select: { id: true, fecha: true, valores: true } },
    },
  });
  if (!paciente || !(await canAccessSede(user, paciente.sedeId))) notFound();

  const historia = paciente.historiaClinica;
  if (!historia) redirect(`/pacientes/${paciente.id}/historia/nueva`);

  // La historia es un expediente vivo: se edita con la plantilla VIGENTE del
  // centro, no con la que tenía cuando se creó.
  const { plantilla } = await obtenerPlantilla(user.centroId, "HISTORIA");
  const accion = actualizarHistoria.bind(null, historia.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar historia clínica"
        subtitle={nombreCompleto(paciente)}
      />
      <div className="max-w-4xl">
        <FichaForm
          plantilla={plantilla}
          valores={normalizarValores(historia.valores, plantilla)}
          fecha={fechaInput(historia.fecha)}
          etiquetaFecha="Fecha de la historia"
          accion={accion}
          cancelarHref={`/pacientes/${paciente.id}/historia`}
          textoGuardar="Guardar historia clínica"
        />
      </div>
    </div>
  );
}
