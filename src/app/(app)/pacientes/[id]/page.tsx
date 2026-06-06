import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser, canAccessSede } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  Card,
  Badge,
  ButtonLink,
} from "@/components/ui";
import { nombreCompleto, edad, fecha } from "@/lib/utils";
import { ApoderadosPanel, type ApoderadoVista } from "../apoderados-panel";
import { EstadoToggle } from "../estado-toggle";

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

  const paciente = await prisma.paciente.findUnique({
    where: { id },
    include: {
      apoderados: {
        orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
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
