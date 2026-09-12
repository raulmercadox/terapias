import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  ButtonLink,
  Card,
  Table,
  Th,
  Td,
  Badge,
} from "@/components/ui";
import { soles, fecha, nombreCompleto } from "@/lib/utils";
import {
  estadoPaqueteColor,
  estadoPaqueteLabel,
  asistenciaColor,
  asistenciaLabel,
} from "../ui";
import SesionFila from "./sesion-fila";
import PaqueteAcciones from "./paquete-acciones";

export default async function PaqueteDetallePage({
  params,
}: PageProps<"/sesiones/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  // El rol USUARIO no ve montos (información de pagos).
  const veMontos = puedeVerPagos(user);

  const paquete = await prisma.paquete.findUnique({
    where: { id },
    select: {
      id: true,
      sedeId: true,
      totalSesiones: true,
      frecuenciaSemana: true,
      precio: true,
      fechaInicio: true,
      fechaFin: true,
      estado: true,
      observacion: true,
      paciente: {
        select: {
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      },
      citas: {
        where: { tipo: "SESION" },
        orderBy: { numeroSesion: "asc" },
        select: {
          id: true,
          numeroSesion: true,
          fecha: true,
          horaInicio: true,
          horaFin: true,
          asistencia: true,
          terapiaRealizada: true,
          observacion: true,
          terapeuta: { select: { id: true, nombres: true, apellidos: true } },
        },
      },
    },
  });

  if (!paquete) notFound();
  if (!(await canAccessSede(user, paquete.sedeId))) notFound();

  const terapeutas = await prisma.terapeuta.findMany({
    where: { sedeId: paquete.sedeId, activo: true },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, nombres: true, apellidos: true },
  });
  const terapeutaOpciones = terapeutas.map((t) => ({
    id: t.id,
    nombre: `${t.apellidos}, ${t.nombres}`,
  }));

  const usadas = paquete.citas.filter(
    (c) => c.asistencia !== "PENDIENTE",
  ).length;
  const restantes = Math.max(0, paquete.totalSesiones - usadas);
  const todasRegistradas =
    paquete.citas.length > 0 &&
    paquete.citas.every((c) => c.asistencia !== "PENDIENTE");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Paquete · ${nombreCompleto(paquete.paciente)}`}
        subtitle={`${paquete.totalSesiones} sesiones · ${paquete.frecuenciaSemana} por semana`}
        actions={
          <ButtonLink href="/sesiones" variant="secondary">
            Volver
          </ButtonLink>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Dato label="Estado">
              <Badge color={estadoPaqueteColor[paquete.estado]}>
                {estadoPaqueteLabel[paquete.estado]}
              </Badge>
            </Dato>
            <Dato label="Sesiones usadas">
              {usadas} / {paquete.totalSesiones}
            </Dato>
            <Dato label="Restantes">{restantes}</Dato>
            {veMontos && <Dato label="Precio">{soles(paquete.precio)}</Dato>}
            <Dato label="Inicio">{fecha(paquete.fechaInicio)}</Dato>
            <Dato label="Fin estimado">{fecha(paquete.fechaFin)}</Dato>
          </div>
          {paquete.observacion && (
            <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {paquete.observacion}
            </p>
          )}
        </Card>

        <Card>
          <PaqueteAcciones
            paqueteId={paquete.id}
            estado={paquete.estado}
            precio={veMontos ? Number(paquete.precio) : null}
            observacion={paquete.observacion ?? ""}
            todasRegistradas={todasRegistradas}
          />
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Sesiones</h2>
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Fecha</Th>
              <Th>Hora</Th>
              <Th>Terapeuta</Th>
              <Th>Asistencia</Th>
              <Th>Observación</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paquete.citas.map((c) => (
              <SesionFila
                key={c.id}
                cita={{
                  id: c.id,
                  numeroSesion: c.numeroSesion,
                  fecha: c.fecha.toISOString(),
                  horaInicio: c.horaInicio,
                  horaFin: c.horaFin,
                  asistencia: c.asistencia,
                  terapiaRealizada: c.terapiaRealizada,
                  observacion: c.observacion,
                  terapeutaId: c.terapeuta?.id ?? null,
                  terapeutaNombre: c.terapeuta
                    ? `${c.terapeuta.apellidos}, ${c.terapeuta.nombres}`
                    : null,
                }}
                terapeutas={terapeutaOpciones}
                asistenciaColor={asistenciaColor[c.asistencia]}
                asistenciaLabel={asistenciaLabel[c.asistencia]}
              />
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-slate-800">{children}</p>
    </div>
  );
}
