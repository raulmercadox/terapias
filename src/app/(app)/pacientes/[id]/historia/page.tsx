import { notFound } from "next/navigation";
import { CentroLogo } from "@/components/centro-logo";
import {
  requireUser,
  canAccessSede,
  getCentro,
  puedeVerPagos,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, ButtonLink } from "@/components/ui";
import { nombreCompleto, edad, fecha } from "@/lib/utils";
import { obtenerPlantilla } from "@/lib/plantillas";
import { normalizarValores } from "@/lib/fichas/valores";
import { FichaVista, Dato } from "@/components/ficha/ficha-vista";
import { ImprimirBoton } from "@/components/imprimir-boton";
import { EliminarHistoriaBoton } from "./eliminar-boton";

const SEXO_LABEL: Record<string, string> = {
  M: "Masculino",
  F: "Femenino",
};

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
  if (!paciente || !(await canAccessSede(user, paciente.sedeId))) notFound();

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

  const [{ plantilla }, centro, sede] = await Promise.all([
    obtenerPlantilla(user.centroId, "HISTORIA"),
    getCentro(user.centroId),
    prisma.sede.findUnique({
      where: { id: paciente.sedeId },
      select: { nombre: true, direccion: true, telefono: true },
    }),
  ]);
  const valores = normalizarValores(historia.valores, plantilla);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Historia clínica"
          subtitle={`${nombreCompleto(paciente)} · ${fecha(historia.fecha)}`}
          actions={
            <>
              <ButtonLink href={`/pacientes/${paciente.id}`} variant="secondary">
                Volver al paciente
              </ButtonLink>
              <ImprimirBoton />
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
      </div>

      <div className="print-area max-w-4xl space-y-6">
        {/* Encabezado del formato impreso: solo se ve en papel. */}
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
            Historia clínica
          </h2>
        </div>

        <FichaVista
          plantilla={plantilla}
          valores={valores}
          encabezado={
            // Los datos del paciente no son campos de la plantilla: salen de su
            // ficha y encabezan la primera sección, como en el formato impreso.
            <dl className="mb-5 grid gap-4 border-b border-slate-100 pb-5 sm:grid-cols-2">
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
              <Dato label="Dirección" value={paciente.direccion} />
              <Dato label="Teléfono" value={paciente.telefono} />
              <Dato label="Fecha de la historia" value={fecha(historia.fecha)} />
            </dl>
          }
        />
      </div>
    </div>
  );
}
