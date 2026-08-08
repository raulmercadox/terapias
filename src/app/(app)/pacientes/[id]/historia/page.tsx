import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Badge, ButtonLink } from "@/components/ui";
import { nombreCompleto, edad, fecha } from "@/lib/utils";
import { normalizarFamiliares, REACCIONES_PADRES } from "./historia";
import { EliminarHistoriaBoton } from "./eliminar-boton";

const SEXO_LABEL: Record<string, string> = {
  M: "Masculino",
  F: "Femenino",
};

/** Las etiquetas replican las del formulario de registro (ver historia-form.tsx). */
const ETIQUETA = "mb-1 block text-sm font-medium text-slate-700";

function Dato({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className={ETIQUETA}>{label}</dt>
      <dd className="text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function DatoLargo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className={ETIQUETA}>{label}</dt>
      <dd className="whitespace-pre-line text-sm text-slate-800">
        {value || "—"}
      </dd>
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

export default async function HistoriaClinicaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const paciente = await prisma.paciente.findUnique({
    where: { id },
    include: { historiaClinica: true },
  });
  if (!paciente || !canAccessSede(user, paciente.sedeId)) notFound();

  const historia = paciente.historiaClinica;

  if (!historia) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Historia clínica"
          subtitle={nombreCompleto(paciente)}
          actions={
            <ButtonLink href={`/pacientes/${paciente.id}`} variant="secondary">
              Volver al paciente
            </ButtonLink>
          }
        />
        <Card>
          <p className="text-sm text-slate-500">
            Este paciente aún no tiene historia clínica registrada.
          </p>
          <div className="mt-4">
            <ButtonLink href={`/pacientes/${paciente.id}/historia/nueva`}>
              Registrar historia clínica
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const familiares = normalizarFamiliares(historia.familiares);
  const reacciones = REACCIONES_PADRES.filter((r) => historia[r.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historia clínica"
        subtitle={`${nombreCompleto(paciente)} · ${fecha(historia.fecha)}`}
        actions={
          <>
            <ButtonLink href={`/pacientes/${paciente.id}`} variant="secondary">
              Volver al paciente
            </ButtonLink>
            <ButtonLink
              href={`/pacientes/${paciente.id}/historia/editar`}
              variant="secondary"
            >
              Editar
            </ButtonLink>
            {user.rol === "ADMINISTRADOR" && (
              <EliminarHistoriaBoton historiaId={historia.id} />
            )}
          </>
        }
      />

      <div className="max-w-4xl space-y-6">
        <Seccion titulo="I. Datos generales">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato label="Nombre y apellidos" value={nombreCompleto(paciente)} />
            <Dato label="Edad" value={edad(paciente.fechaNacimiento)} />
            <Dato
              label="Fecha de nacimiento"
              value={fecha(paciente.fechaNacimiento)}
            />
            <Dato
              label="Sexo"
              value={paciente.sexo ? SEXO_LABEL[paciente.sexo] : "—"}
            />
            <Dato label="Lugar de nacimiento" value={historia.lugarNacimiento} />
            <Dato label="Padre o apoderado" value={historia.padreApoderado} />
            <Dato label="Dirección" value={paciente.direccion} />
            <Dato label="Teléfono" value={paciente.telefono} />
            <Dato label="Fecha de la historia" value={fecha(historia.fecha)} />
          </dl>
        </Seccion>

        <Seccion titulo="II.1 Historia familiar">
          {familiares.length === 0 ? (
            <p className="text-sm text-slate-500">Sin datos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-3">Parentesco</th>
                    <th className="pb-2 pr-3">Nombres</th>
                    <th className="pb-2 pr-3">Edad</th>
                    <th className="pb-2 pr-3">Ocupación</th>
                    <th className="pb-2">Relación con el evaluado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {familiares.map((f, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 font-medium text-slate-700">
                        {f.parentesco || "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-800">
                        {f.nombres || "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-800">{f.edad || "—"}</td>
                      <td className="py-2 pr-3 text-slate-800">
                        {f.ocupacion || "—"}
                      </td>
                      <td className="py-2 text-slate-800">{f.relacion || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Seccion>

        <Seccion titulo="II.2 Historia pre - postnatal">
          <dl className="grid gap-4">
            <DatoLargo
              label="Historia pre - postnatal"
              value={historia.historiaPrePostnatal}
            />
            <DatoLargo
              label="¿Cómo se presentó esta dificultad? ¿Desde cuándo? ¿Quién lo detectó?"
              value={historia.presentacionDificultad}
            />
            <DatoLargo
              label="Signos y síntomas principales"
              value={historia.signosSintomas}
            />
          </dl>
        </Seccion>

        <Seccion titulo="II.3 Historia escolar">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato
              label="E. Temprana: centro educativo"
              value={historia.tempranaCentro}
            />
            <Dato
              label="E. Temprana: adaptación / dificultades"
              value={historia.tempranaAdaptacion}
            />
            <Dato label="Kinder: centro educativo" value={historia.kinderCentro} />
            <Dato
              label="Kinder: adaptación / dificultades"
              value={historia.kinderAdaptacion}
            />
          </dl>
          <dl className="mt-4 grid gap-4">
            <DatoLargo
              label="¿Cómo ha evolucionado desde que apareció por primera vez? ¿Ha notado alguna mejoría?"
              value={historia.evolucionMejoria}
            />
            <DatoLargo
              label="Exámenes realizados"
              value={historia.examenesRealizados}
            />
            <DatoLargo
              label="Tratamiento – terapias recibidas: ¿cuánto tiempo?, ¿en qué instituciones?, evolución del tratamiento"
              value={historia.tratamientosRecibidos}
            />
          </dl>
        </Seccion>

        <Seccion titulo="II.4 Tratamiento farmacológico – medicación">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato
              label="Indicaciones del doctor"
              value={historia.indicacionesDoctor}
            />
            <Dato
              label="Medicinas recomendadas"
              value={historia.medicinasRecomendadas}
            />
            <Dato label="Dosis" value={historia.dosis} />
            <Dato label="Tiempo de inicio" value={historia.tiempoInicio} />
          </dl>
          <dl className="mt-4 grid gap-4">
            <DatoLargo
              label="Observaciones: ¿qué mejoría presenta el menor?"
              value={historia.mejoriaMedicacion}
            />
          </dl>
        </Seccion>

        <Seccion titulo="III. Formación de hábitos">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Dato label="Alimentación" value={historia.alimentacion} />
            <Dato
              label="Control de esfínteres"
              value={historia.controlEsfinteres}
            />
            <Dato label="Sueño" value={historia.sueno} />
            <Dato
              label="Nivel de autonomía personal"
              value={historia.autonomiaPersonal}
            />
          </dl>
        </Seccion>

        <Seccion titulo="IV. Opinión y actitud del padre hacia el hijo">
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-slate-600">
              Reacción de los padres
            </p>
            {reacciones.length === 0 ? (
              <span className="text-sm text-slate-500">—</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {reacciones.map((r) => (
                  <Badge key={r.id} color="sky">
                    {r.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <dl className="grid gap-4">
            <DatoLargo
              label="Detalle de la reacción"
              value={historia.reaccionDetalle}
            />
            <DatoLargo
              label="Creencias sobre el problema, sentimientos de culpa, etc."
              value={historia.creencias}
            />
            <DatoLargo
              label="Cambios: aislarlo o dejarlo con el grupo, exigirle un comportamiento similar, mayor atención, sobreprotección…"
              value={historia.cambiosCrianza}
            />
            <DatoLargo
              label="Uso del castigo: ¿cómo, con qué frecuencia? Reacción del niño"
              value={historia.usoCastigo}
            />
            <DatoLargo
              label="Comportamiento del niño con los padres, hermanos, amigos, otros. Apego del niño, ¿hacia quién?"
              value={historia.comportamientoApego}
            />
          </dl>
        </Seccion>

        <Seccion titulo="V. Antecedentes familiares">
          <dl className="grid gap-4">
            <DatoLargo
              label="¿Enfermedad/condición en la familia? (SI/NO, especificar)"
              value={historia.enfermedadesFamiliares}
            />
            <DatoLargo
              label="Carácter de los padres. Relación de pareja"
              value={historia.caracterPadres}
            />
          </dl>
        </Seccion>

        <Seccion titulo="VI. Observaciones durante la entrevista">
          <p className="whitespace-pre-line text-sm text-slate-800">
            {historia.observacionesEntrevista || "—"}
          </p>
        </Seccion>
      </div>
    </div>
  );
}
