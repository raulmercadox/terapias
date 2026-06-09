import { notFound, redirect } from "next/navigation";
import type { Asistencia, EstadoCita } from "@prisma/client";
import { requireUser, canAccessSede } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  Card,
  Button,
  ButtonLink,
  Badge,
  Field,
  Select,
} from "@/components/ui";
import { fecha, nombreCompleto } from "@/lib/utils";
import {
  ESTADO_COLOR,
  ASISTENCIA_COLOR,
  ASISTENCIA_LABEL,
  TIPO_LABEL,
  normalizarTelefonoPe,
} from "../helpers";
import { marcarAsistencia, cambiarEstado } from "../actions";
import { SeguimientoForm } from "../seguimiento-form";
import { WhatsAppButton } from "../whatsapp-button";
import { DeleteButton } from "../delete-button";

const ASISTENCIAS: Asistencia[] = ["PENDIENTE", "ASISTIO", "FALTO", "TARDANZA"];
const ESTADOS: EstadoCita[] = ["AGENDADA", "ATENDIDA", "CANCELADA"];

export default async function DetalleCitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const cita = await prisma.cita.findUnique({
    where: { id },
    include: {
      sede: { select: { nombre: true } },
      paciente: {
        select: {
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          telefono: true,
          apoderados: {
            orderBy: { principal: "desc" },
            select: { nombres: true, telefono: true, principal: true },
          },
        },
      },
      terapeuta: {
        select: { nombres: true, apellidos: true, especialidad: true },
      },
      observaciones: {
        orderBy: { createdAt: "desc" },
        select: { id: true, texto: true, autor: true, createdAt: true },
      },
    },
  });

  if (!cita) notFound();
  if (!canAccessSede(user, cita.sedeId)) redirect("/citas");

  const pacienteNombre = nombreCompleto(cita.paciente);

  // Teléfono: apoderado principal > primer apoderado con teléfono > teléfono del paciente.
  const apoderadoPrincipal =
    cita.paciente.apoderados.find((a) => a.principal && a.telefono) ??
    cita.paciente.apoderados.find((a) => a.telefono);
  const telefonoRaw = apoderadoPrincipal?.telefono ?? cita.paciente.telefono;
  const telefono = normalizarTelefonoPe(telefonoRaw);

  const mensaje =
    `Hola, le recordamos la cita de ${pacienteNombre} ` +
    `el ${fecha(cita.fecha)} a las ${cita.horaInicio} ` +
    `en ${cita.sede.nombre}. ¡Gracias!`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Cita: ${pacienteNombre}`}
        subtitle={`${fecha(cita.fecha)} · ${cita.horaInicio}–${cita.horaFin} · ${TIPO_LABEL[cita.tipo]}`}
        actions={
          <>
            <ButtonLink href={`/citas/${cita.id}/editar`} variant="secondary">
              Editar
            </ButtonLink>
            <DeleteButton citaId={cita.id} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Datos */}
        <Card className="space-y-3">
          <h2 className="font-semibold text-slate-900">Detalle</h2>
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-slate-500">Paciente</dt>
            <dd className="col-span-2 text-slate-800">{pacienteNombre}</dd>

            <dt className="text-slate-500">Terapeuta</dt>
            <dd className="col-span-2 text-slate-800">
              {cita.terapeuta
                ? `${cita.terapeuta.apellidos} ${cita.terapeuta.nombres}` +
                  (cita.terapeuta.especialidad
                    ? ` (${cita.terapeuta.especialidad})`
                    : "")
                : "Sin asignar"}
            </dd>

            <dt className="text-slate-500">Sede</dt>
            <dd className="col-span-2 text-slate-800">{cita.sede.nombre}</dd>

            <dt className="text-slate-500">Fecha</dt>
            <dd className="col-span-2 text-slate-800">{fecha(cita.fecha)}</dd>

            <dt className="text-slate-500">Horario</dt>
            <dd className="col-span-2 text-slate-800">
              {cita.horaInicio}–{cita.horaFin}
            </dd>

            <dt className="text-slate-500">Tipo</dt>
            <dd className="col-span-2 text-slate-800">{TIPO_LABEL[cita.tipo]}</dd>

            <dt className="text-slate-500">Estado</dt>
            <dd className="col-span-2">
              <Badge color={ESTADO_COLOR[cita.estado]}>{cita.estado}</Badge>
            </dd>

            <dt className="text-slate-500">Asistencia</dt>
            <dd className="col-span-2">
              <Badge color={ASISTENCIA_COLOR[cita.asistencia]}>
                {ASISTENCIA_LABEL[cita.asistencia]}
              </Badge>
            </dd>

            <dt className="text-slate-500">Recordatorio</dt>
            <dd className="col-span-2">
              {cita.recordatorioEnviado ? (
                <Badge color="green">Enviado</Badge>
              ) : (
                <Badge color="slate">No enviado</Badge>
              )}
            </dd>
          </dl>
        </Card>

        {/* Acciones rápidas */}
        <Card className="space-y-5">
          <h2 className="font-semibold text-slate-900">Acciones</h2>

          <form action={marcarAsistencia} className="flex items-end gap-2">
            <input type="hidden" name="id" value={cita.id} />
            <Field label="Marcar asistencia" className="flex-1">
              <Select name="asistencia" defaultValue={cita.asistencia}>
                {ASISTENCIAS.map((a) => (
                  <option key={a} value={a}>
                    {ASISTENCIA_LABEL[a]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              Guardar
            </Button>
          </form>

          <form action={cambiarEstado} className="flex items-end gap-2">
            <input type="hidden" name="id" value={cita.id} />
            <Field label="Cambiar estado" className="flex-1">
              <Select name="estado" defaultValue={cita.estado}>
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              Guardar
            </Button>
          </form>

          <div>
            <p className="mb-1 block text-sm font-medium text-slate-700">
              Recordatorio
            </p>
            <p className="mb-2 text-xs text-slate-500">
              {telefonoRaw
                ? `Se enviará a +${telefono} (${
                    apoderadoPrincipal
                      ? `apoderado: ${apoderadoPrincipal.nombres}`
                      : "paciente"
                  }).`
                : "El paciente/apoderado no tiene teléfono registrado."}
            </p>
            <WhatsAppButton
              citaId={cita.id}
              telefono={telefono}
              mensaje={mensaje}
            />
          </div>
        </Card>
      </div>

      {/* Seguimiento */}
      <Card className="space-y-4">
        <h2 className="font-semibold text-slate-900">Seguimiento de la sesión</h2>
        <SeguimientoForm
          citaId={cita.id}
          terapiaRealizada={cita.terapiaRealizada}
          observaciones={cita.observaciones.map((o) => ({
            id: o.id,
            texto: o.texto,
            autor: o.autor,
            createdAt: o.createdAt.toISOString(),
          }))}
        />
      </Card>
    </div>
  );
}
