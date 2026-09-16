import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Field, Select } from "@/components/ui";
import { nombreCompleto, edad, hoyLima } from "@/lib/utils";
import { obtenerPlantilla } from "@/lib/plantillas";
import { FichaForm } from "@/components/ficha/ficha-form";
import { crearEvaluacion } from "../actions";
import { ProgramaRecomendado } from "../programa-recomendado";

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

  const [terapeutas, { plantilla }] = await Promise.all([
    prisma.terapeuta.findMany({
      where: { sedeId: paciente.sedeId, activo: true },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: { id: true, nombres: true, apellidos: true },
    }),
    obtenerPlantilla(user.centroId, "EVALUACION"),
  ]);

  const accion = crearEvaluacion.bind(null, paciente.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva ficha de evaluación"
        subtitle={`${nombreCompleto(paciente)} · ${edad(paciente.fechaNacimiento)}`}
      />
      <div className="max-w-4xl">
        <FichaForm
          plantilla={plantilla}
          // Precarga el Dx registrado en la ficha del paciente, si la plantilla
          // tiene un campo con ese id.
          valores={
            paciente.diagnostico
              ? { diagnostico: { t: "texto", v: paciente.diagnostico } }
              : undefined
          }
          fecha={hoyLima()}
          etiquetaFecha="Fecha de evaluación"
          accion={accion}
          cancelarHref={`/pacientes/${paciente.id}`}
          textoGuardar="Guardar evaluación"
          extra={
            <Field label="Evaluador(a)">
              <Select name="evaluadorId" defaultValue="">
                <option value="">— Seleccione —</option>
                {terapeutas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {`${t.nombres} ${t.apellidos}`.trim()}
                  </option>
                ))}
              </Select>
            </Field>
          }
          pie={plantilla.muestraProgramaRecomendado ? <ProgramaRecomendado /> : undefined}
        />
      </div>
    </div>
  );
}
