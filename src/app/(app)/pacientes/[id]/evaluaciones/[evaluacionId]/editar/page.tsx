import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto, fecha, fechaInput } from "@/lib/utils";
import { EvaluacionForm } from "../../evaluacion-form";
import { actualizarEvaluacion } from "../../actions";
import { normalizarResultados } from "../../ficha";

export default async function EditarEvaluacionPage({
  params,
}: {
  params: Promise<{ id: string; evaluacionId: string }>;
}) {
  const { id, evaluacionId } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const evaluacion = await prisma.evaluacion.findUnique({
    where: { id: evaluacionId },
    include: {
      paciente: {
        select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true },
      },
    },
  });
  if (
    !evaluacion ||
    evaluacion.pacienteId !== id ||
    !(await canAccessSede(user, evaluacion.sedeId))
  ) {
    notFound();
  }

  const terapeutas = await prisma.terapeuta.findMany({
    where: { sedeId: evaluacion.sedeId, activo: true },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, nombres: true, apellidos: true },
  });

  const accion = actualizarEvaluacion.bind(null, evaluacion.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar ficha de evaluación"
        subtitle={`${nombreCompleto(evaluacion.paciente)} · Evaluación del ${fecha(
          evaluacion.fecha,
        )}`}
      />
      <div className="max-w-4xl">
        <EvaluacionForm
          action={accion}
          terapeutas={terapeutas.map((t) => ({
            id: t.id,
            nombre: `${t.nombres} ${t.apellidos}`.trim(),
          }))}
          inicial={{
            fecha: fechaInput(evaluacion.fecha),
            evaluadorId: evaluacion.evaluadorId,
            lugarNacimiento: evaluacion.lugarNacimiento,
            numeroHermanos: evaluacion.numeroHermanos,
            nivelAcademico: evaluacion.nivelAcademico,
            centroEducativo: evaluacion.centroEducativo,
            conviveMadre: evaluacion.conviveMadre,
            convivePadre: evaluacion.convivePadre,
            conviveHermanos: evaluacion.conviveHermanos,
            conviveOtros: evaluacion.conviveOtros,
            relacionDetalle: evaluacion.relacionDetalle,
            diagnostico: evaluacion.diagnostico,
            medicacion: evaluacion.medicacion,
            terapiasRealiza: evaluacion.terapiasRealiza,
            dificultadesDormir: evaluacion.dificultadesDormir,
            dificultadesComer: evaluacion.dificultadesComer,
            dificultadesPresenta: evaluacion.dificultadesPresenta,
            preescolar: evaluacion.preescolar,
            escolar: evaluacion.escolar,
            comportamientoAula: evaluacion.comportamientoAula,
            rendimientoEscolar: evaluacion.rendimientoEscolar,
            dificultadesEscolares: evaluacion.dificultadesEscolares,
            resultados: normalizarResultados(evaluacion.resultados),
            modalidadLenguaje: evaluacion.modalidadLenguaje,
            observacionSensorial: evaluacion.observacionSensorial,
            observacionMotriz: evaluacion.observacionMotriz,
            observacionGeneral: evaluacion.observacionGeneral,
            programaRecomendado: evaluacion.programaRecomendado,
            recomendaciones: evaluacion.recomendaciones,
          }}
          cancelarHref={`/pacientes/${evaluacion.paciente.id}/evaluaciones/${evaluacion.id}`}
        />
      </div>
    </div>
  );
}
