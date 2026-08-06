import { notFound, redirect } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto, fechaInput } from "@/lib/utils";
import { HistoriaForm } from "../historia-form";
import { actualizarHistoria } from "../actions";
import { normalizarFamiliares } from "../historia";

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
      historiaClinica: true,
    },
  });
  if (!paciente || !canAccessSede(user, paciente.sedeId)) notFound();

  const historia = paciente.historiaClinica;
  if (!historia) redirect(`/pacientes/${paciente.id}/historia/nueva`);

  const accion = actualizarHistoria.bind(null, historia.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar historia clínica"
        subtitle={nombreCompleto(paciente)}
      />
      <div className="max-w-4xl">
        <HistoriaForm
          action={accion}
          inicial={{
            fecha: fechaInput(historia.fecha),
            lugarNacimiento: historia.lugarNacimiento,
            padreApoderado: historia.padreApoderado,
            familiares: normalizarFamiliares(historia.familiares),
            historiaPrePostnatal: historia.historiaPrePostnatal,
            presentacionDificultad: historia.presentacionDificultad,
            signosSintomas: historia.signosSintomas,
            tempranaCentro: historia.tempranaCentro,
            tempranaAdaptacion: historia.tempranaAdaptacion,
            kinderCentro: historia.kinderCentro,
            kinderAdaptacion: historia.kinderAdaptacion,
            evolucionMejoria: historia.evolucionMejoria,
            examenesRealizados: historia.examenesRealizados,
            tratamientosRecibidos: historia.tratamientosRecibidos,
            indicacionesDoctor: historia.indicacionesDoctor,
            medicinasRecomendadas: historia.medicinasRecomendadas,
            dosis: historia.dosis,
            tiempoInicio: historia.tiempoInicio,
            mejoriaMedicacion: historia.mejoriaMedicacion,
            alimentacion: historia.alimentacion,
            controlEsfinteres: historia.controlEsfinteres,
            sueno: historia.sueno,
            autonomiaPersonal: historia.autonomiaPersonal,
            reaccionRechazo: historia.reaccionRechazo,
            reaccionIndiferencia: historia.reaccionIndiferencia,
            reaccionAceptacion: historia.reaccionAceptacion,
            reaccionPreocupacion: historia.reaccionPreocupacion,
            reaccionVerguenza: historia.reaccionVerguenza,
            reaccionDetalle: historia.reaccionDetalle,
            creencias: historia.creencias,
            cambiosCrianza: historia.cambiosCrianza,
            usoCastigo: historia.usoCastigo,
            comportamientoApego: historia.comportamientoApego,
            enfermedadesFamiliares: historia.enfermedadesFamiliares,
            caracterPadres: historia.caracterPadres,
            observacionesEntrevista: historia.observacionesEntrevista,
          }}
          cancelarHref={`/pacientes/${paciente.id}/historia`}
        />
      </div>
    </div>
  );
}
