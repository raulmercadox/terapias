import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge, ButtonLink } from "@/components/ui";
import { nombreCompleto, edad, fecha } from "@/lib/utils";
import {
  AREAS_FICHA,
  IPL_LABEL,
  MODALIDAD_LABEL,
  gruposVisibles,
  normalizarResultados,
  type ModalidadLenguaje,
} from "../ficha";
import { EliminarEvaluacionBoton } from "./eliminar-boton";

const PROGRAMA_LABEL: Record<string, string> = {
  ESCOLAR: "Escolar",
  INTERDIARIO: "Terapias Grupales",
  TERAPIAS: "Terapia Individual",
};

const SEXO_LABEL: Record<string, string> = {
  M: "Masculino",
  F: "Femenino",
};

function Dato({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {titulo}
      </h2>
      {children}
    </Card>
  );
}

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
    !canAccessSede(user, evaluacion.sedeId)
  ) {
    notFound();
  }

  const p = evaluacion.paciente;
  const res = normalizarResultados(evaluacion.resultados);

  return (
    <div className="space-y-6">
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

      <div className="max-w-4xl space-y-6">
        <Seccion titulo="I. Datos personales">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato label="Nombres y apellidos" value={nombreCompleto(p)} />
            <Dato label="Edad" value={edad(p.fechaNacimiento)} />
            <Dato label="Género" value={p.sexo ? SEXO_LABEL[p.sexo] : "—"} />
            <Dato label="Lugar de nacimiento" value={evaluacion.lugarNacimiento} />
            <Dato label="Fecha de nacimiento" value={fecha(p.fechaNacimiento)} />
            <Dato label="N° de hermanos" value={evaluacion.numeroHermanos} />
            <Dato label="Nivel académico" value={evaluacion.nivelAcademico} />
            <Dato label="Centro educativo" value={evaluacion.centroEducativo} />
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
          </dl>
        </Seccion>

        <Seccion titulo="II. Relación del menor con las personas que convive">
          <div className="mb-3 flex flex-wrap gap-2">
            {evaluacion.conviveMadre && <Badge color="sky">Madre</Badge>}
            {evaluacion.convivePadre && <Badge color="sky">Padre</Badge>}
            {evaluacion.conviveHermanos && <Badge color="sky">Hermanos</Badge>}
            {evaluacion.conviveOtros && (
              <Badge color="sky">Otros: {evaluacion.conviveOtros}</Badge>
            )}
            {!evaluacion.conviveMadre &&
              !evaluacion.convivePadre &&
              !evaluacion.conviveHermanos &&
              !evaluacion.conviveOtros && (
                <span className="text-sm text-slate-500">—</span>
              )}
          </div>
          {evaluacion.relacionDetalle && (
            <p className="whitespace-pre-line text-sm text-slate-800">
              {evaluacion.relacionDetalle}
            </p>
          )}
        </Seccion>

        <Seccion titulo="III. Historia personal">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato label="Evaluación (Dx)" value={evaluacion.diagnostico} />
            <Dato label="Medicación (dosis)" value={evaluacion.medicacion} />
            <Dato label="Terapias que realiza" value={evaluacion.terapiasRealiza} />
            <Dato
              label="Dificultades para dormir"
              value={evaluacion.dificultadesDormir}
            />
            <Dato
              label="Dificultades en la alimentación"
              value={evaluacion.dificultadesComer}
            />
            <Dato
              label="Dificultades que presenta"
              value={evaluacion.dificultadesPresenta}
            />
          </dl>
        </Seccion>

        <Seccion titulo="IV. Antecedentes escolares">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato label="Preescolar" value={evaluacion.preescolar} />
            <Dato label="Escolar" value={evaluacion.escolar} />
            <Dato
              label="Comportamiento en el aula"
              value={evaluacion.comportamientoAula}
            />
            <Dato
              label="Rendimiento escolar"
              value={evaluacion.rendimientoEscolar}
            />
            <Dato
              label="Dificultades que presenta"
              value={evaluacion.dificultadesEscolares}
            />
          </dl>
        </Seccion>

        {AREAS_FICHA.map((area) => (
          <Seccion key={area.id} titulo={area.titulo}>
            {area.tipo === "IPL" && (
              <p className="mb-3 text-xs text-slate-500">
                Indicadores: I = {IPL_LABEL.I}, P = {IPL_LABEL.P}, L ={" "}
                {IPL_LABEL.L}.
              </p>
            )}
            {area.id === "lenguaje" && evaluacion.modalidadLenguaje && (
              <p className="mb-3 text-sm text-slate-700">
                <span className="font-medium">Modalidad:</span>{" "}
                {MODALIDAD_LABEL[
                  evaluacion.modalidadLenguaje as ModalidadLenguaje
                ] ?? evaluacion.modalidadLenguaje}
              </p>
            )}
            <div className="space-y-4">
              {gruposVisibles(
                area,
                area.id === "lenguaje" ? evaluacion.modalidadLenguaje : null,
              ).map((grupo, gi) => (
                <div key={gi}>
                  {grupo.titulo && (
                    <h3 className="mb-2 text-sm font-medium text-slate-600">
                      {grupo.titulo}
                    </h3>
                  )}
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {grupo.items.map((item) => {
                      const r = res[item.id];
                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                        >
                          <span className="text-sm text-slate-700">
                            {item.label}
                            {r?.obs && (
                              <span className="ml-2 text-xs italic text-slate-500">
                                {r.obs}
                              </span>
                            )}
                          </span>
                          {r?.valor ? (
                            <Badge
                              color={
                                r.valor === "L" || r.valor === "SI"
                                  ? "green"
                                  : r.valor === "P"
                                    ? "amber"
                                    : r.valor === "NO"
                                      ? "red"
                                      : "slate"
                              }
                            >
                              {area.tipo === "IPL"
                                ? `${r.valor} · ${IPL_LABEL[r.valor]}`
                                : r.valor === "SI"
                                  ? "Sí"
                                  : "No"}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Sin evaluar
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {area.id === "sensorial" && evaluacion.observacionSensorial && (
              <p className="mt-4 text-sm text-slate-800">
                <span className="font-medium">
                  Observación (hipo – híper sensibilidad):
                </span>{" "}
                {evaluacion.observacionSensorial}
              </p>
            )}
            {area.id === "psicomotricidad" && evaluacion.observacionMotriz && (
              <p className="mt-4 text-sm text-slate-800">
                <span className="font-medium">
                  Observación (presenta problemas motrices):
                </span>{" "}
                {evaluacion.observacionMotriz}
              </p>
            )}
          </Seccion>
        ))}

        <Seccion titulo="X. Observación durante la evaluación">
          <p className="whitespace-pre-line text-sm text-slate-800">
            {evaluacion.observacionGeneral || "—"}
          </p>
        </Seccion>

        <Seccion titulo="Resultado: programa recomendado">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato
              label="Programa recomendado"
              value={
                evaluacion.programaRecomendado
                  ? PROGRAMA_LABEL[evaluacion.programaRecomendado] ??
                    evaluacion.programaRecomendado
                  : "—"
              }
            />
            <Dato label="Recomendaciones" value={evaluacion.recomendaciones} />
          </dl>
        </Seccion>
      </div>
    </div>
  );
}
