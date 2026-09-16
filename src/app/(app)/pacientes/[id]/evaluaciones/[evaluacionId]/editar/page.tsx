import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Field, Select } from "@/components/ui";
import { nombreCompleto, fecha, fechaInput } from "@/lib/utils";
import { normalizarPlantilla } from "@/lib/fichas/plantilla";
import { normalizarValores } from "@/lib/fichas/valores";
import { FichaForm } from "@/components/ficha/ficha-form";
import { actualizarEvaluacion } from "../../actions";
import { CierreEvaluacion } from "../../programa-recomendado";

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

  // Se edita con la plantilla CONGELADA en la ficha, no con la vigente del
  // centro: corregir una evaluación no debe reinterpretarla con otra escala.
  const estructura = normalizarPlantilla(evaluacion.estructura);
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
        <FichaForm
          plantilla={estructura}
          valores={normalizarValores(evaluacion.valores, estructura)}
          fecha={fechaInput(evaluacion.fecha)}
          etiquetaFecha="Fecha de evaluación"
          accion={accion}
          cancelarHref={`/pacientes/${evaluacion.paciente.id}/evaluaciones/${evaluacion.id}`}
          textoGuardar="Guardar evaluación"
          extra={
            <Field label="Evaluador(a)">
              <Select name="evaluadorId" defaultValue={evaluacion.evaluadorId ?? ""}>
                <option value="">— Seleccione —</option>
                {terapeutas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {`${t.nombres} ${t.apellidos}`.trim()}
                  </option>
                ))}
              </Select>
            </Field>
          }
          pie={
            <CierreEvaluacion
              muestraPrograma={estructura.muestraProgramaRecomendado === true}
              programaRecomendado={evaluacion.programaRecomendado}
              recomendaciones={evaluacion.recomendaciones}
            />
          }
        />
      </div>
    </div>
  );
}
