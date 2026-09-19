import { notFound } from "next/navigation";
import { CentroLogo } from "@/components/centro-logo";
import {
  requireUser,
  canAccessSede,
  getCentro,
  puedeVerPagos,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge, ButtonLink } from "@/components/ui";
import { nombreCompleto, edad, fecha } from "@/lib/utils";
import { obtenerPlantilla } from "@/lib/plantillas";
import { normalizarPlantilla } from "@/lib/fichas/plantilla";
import { normalizarValores } from "@/lib/fichas/valores";
import { estaDesactualizada } from "@/lib/fichas/snapshot";
import { FichaVista, Dato } from "@/components/ficha/ficha-vista";
import { ImprimirBoton } from "@/components/imprimir-boton";
import { EliminarEvaluacionBoton } from "./eliminar-boton";
import { ActualizarPlantillaBoton } from "./actualizar-plantilla-boton";

const PROGRAMA_LABEL: Record<string, string> = {
  ESCOLAR: "Escolar",
  INTERDIARIO: "Terapias Grupales",
  TERAPIAS: "Terapia Individual",
};

const SEXO_LABEL: Record<string, string> = {
  M: "Masculino",
  F: "Femenino",
};

export default async function EvaluacionDetallePage({
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
      paciente: true,
      evaluador: { select: { nombres: true, apellidos: true } },
    },
  });
  if (
    !evaluacion ||
    evaluacion.pacienteId !== id ||
    !(await canAccessSede(user, evaluacion.sedeId))
  ) {
    notFound();
  }

  const p = evaluacion.paciente;
  // La ficha se lee con la plantilla que se le congeló al aplicarla.
  const estructura = normalizarPlantilla(evaluacion.estructura);
  const valores = normalizarValores(evaluacion.valores, estructura);

  const [vigente, centro, sede] = await Promise.all([
    obtenerPlantilla(user.centroId, "EVALUACION"),
    getCentro(user.centroId),
    prisma.sede.findUnique({
      where: { id: evaluacion.sedeId },
      select: { nombre: true, direccion: true },
    }),
  ]);
  const desactualizada = estaDesactualizada(
    evaluacion.plantillaVersion,
    vigente.version,
  );

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Ficha de evaluación"
          subtitle={`${nombreCompleto(p)} · Evaluación del ${fecha(evaluacion.fecha)}`}
          actions={
            <>
              {evaluacion.programaRecomendado && (
                <Badge color="sky">
                  {PROGRAMA_LABEL[evaluacion.programaRecomendado] ??
                    evaluacion.programaRecomendado}
                </Badge>
              )}
              <ButtonLink href={`/pacientes/${p.id}`} variant="secondary">
                Volver al paciente
              </ButtonLink>
              <ImprimirBoton />
              <ButtonLink
                href={`/pacientes/${p.id}/evaluaciones/${evaluacion.id}/editar`}
                variant="secondary"
              >
                Editar
              </ButtonLink>
              {user.rol === "ADMINISTRADOR" && (
                <EliminarEvaluacionBoton evaluacionId={evaluacion.id} />
              )}
            </>
          }
        />
      </div>

      {desactualizada && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            Esta ficha se aplicó con la versión {evaluacion.plantillaVersion} de la
            plantilla; la vigente del centro es la {vigente.version}. Se conserva tal
            como se registró.
          </span>
          <ActualizarPlantillaBoton evaluacionId={evaluacion.id} />
        </div>
      )}

      <div className="print-area max-w-4xl space-y-6">
        <div className="hidden print:block">
          <div className="flex items-start gap-4">
            <CentroLogo logoActualizadoEn={centro.logoActualizadoEn} className="h-16 w-auto max-w-40" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">{centro.nombre}</h1>
              {centro.subtitulo && (
                <p className="text-sm text-slate-600">{centro.subtitulo}</p>
              )}
              <p className="mt-1 text-sm font-medium text-slate-700">
                Sede: {sede?.nombre}
                {sede?.direccion ? ` · ${sede.direccion}` : ""}
              </p>
            </div>
          </div>
          <h2 className="mt-3 text-center text-base font-bold uppercase tracking-wide text-slate-900">
            Ficha de evaluación
          </h2>
        </div>

        <FichaVista
          plantilla={estructura}
          valores={valores}
          encabezado={
            <dl className="mb-5 grid gap-4 border-b border-slate-100 pb-5 sm:grid-cols-2">
              <Dato label="Nombres y apellidos" value={nombreCompleto(p)} />
              <Dato label="Edad" value={edad(p.fechaNacimiento)} />
              <Dato label="Género" value={p.sexo ? SEXO_LABEL[p.sexo] : "—"} />
              <Dato label="Fecha de nacimiento" value={fecha(p.fechaNacimiento)} />
              <Dato label="Dirección" value={p.direccion} />
              <Dato label="N° de celular" value={p.telefono} />
              <Dato
                label="Evaluador(a)"
                value={
                  evaluacion.evaluador
                    ? `${evaluacion.evaluador.nombres} ${evaluacion.evaluador.apellidos}`.trim()
                    : "—"
                }
              />
              <Dato label="Fecha de evaluación" value={fecha(evaluacion.fecha)} />
            </dl>
          }
        />

        {/* Las recomendaciones cierran la ficha en cualquier rubro; el programa
            recomendado solo si la plantilla lo usa. */}
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {estructura.muestraProgramaRecomendado
              ? "Resultado: programa recomendado"
              : "Recomendaciones"}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {estructura.muestraProgramaRecomendado && (
              <Dato
                label="Programa recomendado"
                value={
                  evaluacion.programaRecomendado
                    ? (PROGRAMA_LABEL[evaluacion.programaRecomendado] ??
                      evaluacion.programaRecomendado)
                    : null
                }
              />
            )}
            <Dato
              label={
                estructura.muestraProgramaRecomendado
                  ? "Recomendaciones"
                  : "Conclusiones y plan sugerido"
              }
              value={evaluacion.recomendaciones}
            />
          </dl>
        </Card>
      </div>
    </div>
  );
}
