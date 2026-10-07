import { notFound } from "next/navigation";
import {
  requireUser,
  canAccessSede,
  requireAccesoClinico,
  evaluadorFijoDe,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto, edad, hoyLima, fecha } from "@/lib/utils";
import { obtenerPlantilla } from "@/lib/plantillas";
import { FichaForm } from "@/components/ficha/ficha-form";
import { crearEvaluacion } from "../actions";
import { CampoEvaluador } from "../campo-evaluador";
import { CierreEvaluacion } from "../programa-recomendado";
import { opcionesTerapia } from "../terapias";

export default async function NuevaEvaluacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  await requireAccesoClinico(user, id);

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

  const [terapeutas, { plantilla }, terapias, abierta] = await Promise.all([
    prisma.terapeuta.findMany({
      where: { sedeId: paciente.sedeId, activo: true },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: { id: true, nombres: true, apellidos: true },
    }),
    obtenerPlantilla(user.centroId, "EVALUACION"),
    opcionesTerapia(paciente.sedeId),
    // La nueva evaluación cerrará la que esté abierta (solo una a la vez).
    prisma.evaluacion.findFirst({
      where: { pacienteId: paciente.id, cerradaEn: null },
      select: { fecha: true },
    }),
  ]);

  // Para el terapeuta, el evaluador es él mismo y no se puede cambiar.
  const evaluadorFijo = await evaluadorFijoDe(user);
  const accion = crearEvaluacion.bind(null, paciente.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva ficha de evaluación"
        subtitle={`${nombreCompleto(paciente)} · ${edad(paciente.fechaNacimiento)}`}
      />
      <div className="max-w-4xl space-y-4">
        {abierta && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Al guardar se cerrará la evaluación abierta del {fecha(abierta.fecha)}:
            los nuevos paquetes y renovaciones usarán esta.
          </p>
        )}
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
            <CampoEvaluador
              terapeutas={terapeutas}
              evaluadorFijo={evaluadorFijo}
            />
          }
          pie={
            <CierreEvaluacion borradorId={`nueva-${paciente.id}`} terapias={terapias} />
          }
        />
      </div>
    </div>
  );
}
