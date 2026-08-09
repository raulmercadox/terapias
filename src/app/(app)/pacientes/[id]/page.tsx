import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  Card,
  Badge,
  ButtonLink,
} from "@/components/ui";
import Link from "next/link";
import { nombreCompleto, edad, fecha } from "@/lib/utils";
import { ApoderadosPanel, type ApoderadoVista } from "../apoderados-panel";
import { EstadoToggle } from "../estado-toggle";
import { normalizarSecciones, resumenAvance } from "./informes/informe";

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

export default async function PacienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const paciente = await prisma.paciente.findUnique({
    where: { id },
    include: {
      apoderados: {
        orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
      },
      evaluaciones: {
        orderBy: { fecha: "desc" },
        select: {
          id: true,
          fecha: true,
          programaRecomendado: true,
          evaluador: { select: { nombres: true, apellidos: true } },
        },
      },
      historiaClinica: { select: { id: true, fecha: true, updatedAt: true } },
      informesAvance: {
        orderBy: { fecha: "desc" },
        select: {
          id: true,
          fecha: true,
          secciones: true,
          evaluador: { select: { nombres: true, apellidos: true } },
        },
      },
    },
  });

  if (!paciente || !canAccessSede(user, paciente.sedeId)) notFound();

  const apoderados: ApoderadoVista[] = paciente.apoderados.map((a) => ({
    id: a.id,
    nombres: a.nombres,
    apellidos: a.apellidos,
    dni: a.dni,
    telefono: a.telefono,
    correo: a.correo,
    vinculo: a.vinculo,
    principal: a.principal,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={nombreCompleto(paciente)}
        subtitle={`${PROGRAMA_LABEL[paciente.programa] ?? paciente.programa} · ${edad(
          paciente.fechaNacimiento,
        )}`}
        actions={
          <>
            {paciente.estado === "ACTIVO" ? (
              <Badge color="green">ACTIVO</Badge>
            ) : (
              <Badge color="red">BAJA</Badge>
            )}
            <ButtonLink href={`/pacientes/${paciente.id}/editar`} variant="secondary">
              Editar
            </ButtonLink>
            <EstadoToggle pacienteId={paciente.id} estado={paciente.estado} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Datos personales
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Dato label="Nombres" value={paciente.nombres} />
              <Dato
                label="Apellidos"
                value={[paciente.apellidoPaterno, paciente.apellidoMaterno]
                  .filter(Boolean)
                  .join(" ")}
              />
              <Dato label="DNI" value={paciente.dni} />
              <Dato
                label="Fecha de nacimiento"
                value={fecha(paciente.fechaNacimiento)}
              />
              <Dato label="Edad" value={edad(paciente.fechaNacimiento)} />
              <Dato
                label="Sexo"
                value={paciente.sexo ? SEXO_LABEL[paciente.sexo] : "—"}
              />
              <Dato label="Teléfono" value={paciente.telefono} />
              <Dato label="Correo" value={paciente.correo} />
              <Dato label="Dirección" value={paciente.direccion} />
              <Dato label="Distrito" value={paciente.distrito} />
              <Dato
                label="Programa"
                value={PROGRAMA_LABEL[paciente.programa] ?? paciente.programa}
              />
            </dl>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Información clínica
            </h2>
            <dl className="grid gap-4">
              <Dato label="Diagnóstico" value={paciente.diagnostico} />
              <Dato label="Observaciones" value={paciente.observaciones} />
            </dl>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Historia clínica
                </h2>
                {paciente.historiaClinica ? (
                  <Link
                    href={`/pacientes/${paciente.id}/historia`}
                    className="mt-1 block text-sm font-medium text-sky-700 hover:underline"
                  >
                    Historia clínica del {fecha(paciente.historiaClinica.fecha)}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    Este paciente aún no tiene historia clínica.
                  </p>
                )}
              </div>
              {paciente.historiaClinica ? (
                <ButtonLink
                  href={`/pacientes/${paciente.id}/historia`}
                  variant="secondary"
                >
                  Ver historia
                </ButtonLink>
              ) : (
                <ButtonLink
                  href={`/pacientes/${paciente.id}/historia/nueva`}
                  variant="secondary"
                >
                  Registrar historia
                </ButtonLink>
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Evaluaciones
              </h2>
              <ButtonLink
                href={`/pacientes/${paciente.id}/evaluaciones/nueva`}
                variant="secondary"
              >
                Nueva evaluación
              </ButtonLink>
            </div>
            {paciente.evaluaciones.length === 0 ? (
              <p className="text-sm text-slate-500">
                Este paciente aún no tiene fichas de evaluación.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {paciente.evaluaciones.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div>
                      <Link
                        href={`/pacientes/${paciente.id}/evaluaciones/${ev.id}`}
                        className="text-sm font-medium text-sky-700 hover:underline"
                      >
                        Evaluación del {fecha(ev.fecha)}
                      </Link>
                      {ev.evaluador && (
                        <p className="text-xs text-slate-500">
                          {`${ev.evaluador.nombres} ${ev.evaluador.apellidos}`.trim()}
                        </p>
                      )}
                    </div>
                    {ev.programaRecomendado && (
                      <Badge color="sky">
                        {PROGRAMA_LABEL[ev.programaRecomendado] ??
                          ev.programaRecomendado}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Informes de avance
              </h2>
              <ButtonLink
                href={`/pacientes/${paciente.id}/informes/nuevo`}
                variant="secondary"
              >
                Nuevo informe
              </ButtonLink>
            </div>
            {paciente.informesAvance.length === 0 ? (
              <p className="text-sm text-slate-500">
                Este paciente aún no tiene informes de avance.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {paciente.informesAvance.map((inf) => {
                  const { calificados, total } = resumenAvance(
                    normalizarSecciones(inf.secciones),
                  );
                  return (
                    <li
                      key={inf.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    >
                      <div>
                        <Link
                          href={`/pacientes/${paciente.id}/informes/${inf.id}`}
                          className="text-sm font-medium text-sky-700 hover:underline"
                        >
                          Informe del {fecha(inf.fecha)}
                        </Link>
                        {inf.evaluador && (
                          <p className="text-xs text-slate-500">
                            {`${inf.evaluador.nombres} ${inf.evaluador.apellidos}`.trim()}
                          </p>
                        )}
                      </div>
                      <Badge color={calificados === total ? "green" : "slate"}>
                        {calificados}/{total} calificados
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <ApoderadosPanel pacienteId={paciente.id} apoderados={apoderados} />
        </div>

        <div className="space-y-6">
          {paciente.fotoUrl && (
            <Card>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={paciente.fotoUrl}
                alt={nombreCompleto(paciente)}
                className="mx-auto max-h-56 rounded-lg object-cover"
              />
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Accesos rápidos
            </h2>
            <div className="flex flex-col gap-2">
              <ButtonLink
                href={`/citas?pacienteId=${paciente.id}`}
                variant="secondary"
              >
                Ver citas
              </ButtonLink>
              <ButtonLink
                href={`/sesiones?pacienteId=${paciente.id}`}
                variant="secondary"
              >
                Ver paquetes / sesiones
              </ButtonLink>
              <ButtonLink
                href={`/pagos?pacienteId=${paciente.id}`}
                variant="secondary"
              >
                Ver pagos
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
