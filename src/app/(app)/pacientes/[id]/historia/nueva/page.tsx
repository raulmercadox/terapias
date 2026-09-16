import { notFound, redirect } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto, hoyLima } from "@/lib/utils";
import { obtenerPlantilla } from "@/lib/plantillas";
import { FichaForm } from "@/components/ficha/ficha-form";
import { crearHistoria } from "../actions";

export default async function NuevaHistoriaPage({
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
      historiaClinica: { select: { id: true } },
    },
  });
  if (!paciente || !(await canAccessSede(user, paciente.sedeId))) notFound();

  // La historia clínica es única: si ya existe, se edita en su lugar.
  if (paciente.historiaClinica) {
    redirect(`/pacientes/${paciente.id}/historia`);
  }

  const { plantilla } = await obtenerPlantilla(user.centroId, "HISTORIA");
  const accion = crearHistoria.bind(null, paciente.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar historia clínica"
        subtitle={nombreCompleto(paciente)}
      />
      <div className="max-w-4xl">
        <FichaForm
          plantilla={plantilla}
          fecha={hoyLima()}
          etiquetaFecha="Fecha de la historia"
          accion={accion}
          cancelarHref={`/pacientes/${paciente.id}`}
          textoGuardar="Guardar historia clínica"
        />
      </div>
    </div>
  );
}
