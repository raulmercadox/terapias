import { notFound } from "next/navigation";
import {
  requireUser,
  requireActiveSede,
  esTerapeuta,
  puedeVerPagos,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, ButtonLink, Card, EmptyState } from "@/components/ui";
import { fecha, nombreCompleto } from "@/lib/utils";
import { claveFecha } from "../horario";
import { paqueteRenovable } from "../renovable";
import NuevoPaqueteForm from "./form";

export default async function NuevoPaquetePage({
  searchParams,
}: PageProps<"/sesiones/nuevo">) {
  const user = await requireUser();
  // El terapeuta no gestiona paquetes ni agenda citas libremente.
  if (esTerapeuta(user)) notFound();
  const sedeId = await requireActiveSede(user);

  const {
    evaluacion: evaluacionParam,
    pacienteId: pacienteParam,
    renovar: renovarParam,
  } = await searchParams;

  // Renovación: aplica de nuevo la evaluación (abierta) del paquete anterior.
  const renovable =
    typeof renovarParam === "string" ? await paqueteRenovable(renovarParam) : null;
  const errorRenovacion =
    renovable && "error" in renovable
      ? renovable.error
      : renovable && renovable.paquete.sedeId !== sedeId
        ? "El paquete es de otra sede. Cambia a su sede para renovarlo."
        : null;
  const renovacion =
    renovable && "paquete" in renovable && !errorRenovacion ? renovable.paquete : null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  // Horizonte para el calendario de disponibilidad (~1 año: el usuario navega
  // semana a semana marcando sesiones concretas).
  const horizonte = new Date(hoy);
  horizonte.setDate(horizonte.getDate() + 430);

  const [pacientes, evaluaciones, terapias, terapeutas, sede, feriados, citasFuturas] =
    await Promise.all([
      prisma.paciente.findMany({
        where: { sedeId, estado: "ACTIVO" },
        orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
        select: {
          id: true,
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      }),
      // Solo las evaluaciones abiertas que sugieren un tratamiento sirven para agendar.
      prisma.evaluacion.findMany({
        where: {
          sedeId,
          cerradaEn: null,
          paciente: { estado: "ACTIVO" },
          tratamiento: { some: {} },
        },
        orderBy: { fecha: "desc" },
        select: {
          id: true,
          pacienteId: true,
          fecha: true,
          plazoSemanas: true,
          evaluador: { select: { nombres: true, apellidos: true } },
          tratamiento: {
            orderBy: { orden: "asc" },
            select: { terapiaId: true, sesiones: true, sesionesSemana: true },
          },
        },
      }),
      prisma.terapia.findMany({
        where: { sedeId },
        orderBy: { nombre: "asc" },
        select: {
          id: true,
          nombre: true,
          activo: true,
          modalidad: true,
          maxParticipantes: true,
          duracionMin: true,
          especialidadId: true,
          especialidad: { select: { nombre: true } },
        },
      }),
      prisma.terapeuta.findMany({
        where: { sedeId, activo: true },
        orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          refrigerioInicio: true,
          refrigerioFin: true,
          especialidades: { select: { especialidadId: true } },
          vacaciones: {
            where: { fechaFin: { gte: hoy } },
            select: { fechaInicio: true, fechaFin: true },
          },
        },
      }),
      prisma.sede.findUnique({
        where: { id: sedeId },
        select: {
          horaApertura: true,
          horaCierre: true,
          refrigerioInicio: true,
          refrigerioFin: true,
          diasLaborales: true,
          intervaloCalendario: true,
          intervalosCalendario: true,
        },
      }),
      prisma.feriado.findMany({
        where: { sedeId, fecha: { gte: hoy } },
        orderBy: { fecha: "asc" },
        select: { fecha: true },
      }),
      prisma.cita.findMany({
        where: {
          sedeId,
          estado: { not: "CANCELADA" },
          fecha: { gte: hoy, lt: horizonte },
        },
        select: {
          terapeutaId: true,
          pacienteId: true,
          terapiaId: true,
          fecha: true,
          horaInicio: true,
          horaFin: true,
        },
      }),
    ]);

  const evaluacionInicial = renovacion
    ? evaluaciones.find((e) => e.id === renovacion.evaluacionId)
    : typeof evaluacionParam === "string"
      ? evaluaciones.find((e) => e.id === evaluacionParam)
      : undefined;
  // La evaluación puede no tener tratamiento o el paciente estar inactivo.
  const errorFormulario =
    errorRenovacion ??
    (renovacion && !evaluacionInicial
      ? "La evaluación del paquete no sugiere terapias o el paciente está inactivo. Edita la evaluación o crea el paquete desde otra."
      : null);
  // Desde la ficha del paciente (?pacienteId=): lo preselecciona; el form toma
  // su evaluación más reciente. Solo si es un paciente activo de la sede.
  const pacienteInicial =
    evaluacionInicial?.pacienteId ??
    (typeof pacienteParam === "string" && pacientes.some((p) => p.id === pacienteParam)
      ? pacienteParam
      : undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        title={renovacion ? "Renovar paquete" : "Nuevo paquete"}
        subtitle={
          renovacion
            ? renovacion.evaluacionAnteriorFecha
              ? `Se aplica la nueva evaluación del ${fecha(renovacion.evaluacionFecha)} (reemplazó a la del ${fecha(renovacion.evaluacionAnteriorFecha)}). Revisa terapeutas y sesiones antes de crear el paquete.`
              : `Se aplica de nuevo la evaluación del ${fecha(renovacion.evaluacionFecha)}. Revisa terapeutas y sesiones antes de crear el paquete.`
            : "Elige la evaluación del paciente y agenda cada terapia de su tratamiento."
        }
        actions={
          <ButtonLink
            href={
              typeof renovarParam === "string" ? `/sesiones/${renovarParam}` : "/sesiones"
            }
            variant="secondary"
          >
            Volver
          </ButtonLink>
        }
      />

      {errorFormulario && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {errorFormulario}
        </p>
      )}

      {!renovable && typeof evaluacionParam === "string" && !evaluacionInicial && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          La evaluación indicada no está disponible: es de otra sede, está
          cerrada o no sugiere terapias. Cambia a la sede del paciente o usa
          una evaluación abierta.
        </p>
      )}

      {errorFormulario ? null : pacientes.length === 0 ? (
        <EmptyState message="No hay pacientes activos en esta sede. Registre un paciente antes de crear un paquete." />
      ) : terapeutas.length === 0 ? (
        <EmptyState message="No hay terapeutas activos en esta sede. Registre un terapeuta en Configuración › Terapeutas antes de crear un paquete." />
      ) : (
        <Card className="max-w-3xl">
          <NuevoPaqueteForm
            sedeId={sedeId}
            pacientes={pacientes.map((p) => ({
              id: p.id,
              nombre: nombreCompleto(p),
            }))}
            evaluaciones={evaluaciones.map((e) => ({
              id: e.id,
              pacienteId: e.pacienteId,
              etiqueta: `Evaluación del ${fecha(e.fecha)}${
                e.evaluador ? ` · ${e.evaluador.nombres} ${e.evaluador.apellidos}` : ""
              }`,
              plazoSemanas: e.plazoSemanas,
              tratamiento: e.tratamiento,
            }))}
            pacienteInicial={pacienteInicial}
            evaluacionInicialId={evaluacionInicial?.id}
            renovacion={
              renovacion
                ? {
                    paqueteId: renovacion.id,
                    precio: puedeVerPagos(user) ? renovacion.precio : null,
                    observacion: renovacion.observacion ?? "",
                    sugerencias: renovacion.sugerencias,
                  }
                : undefined
            }
            terapias={terapias.map((t) => ({
              id: t.id,
              nombre: t.nombre,
              activo: t.activo,
              modalidad: t.modalidad,
              maxParticipantes: t.maxParticipantes,
              duracionMin: t.duracionMin,
              especialidadId: t.especialidadId,
              especialidad: t.especialidad?.nombre ?? null,
            }))}
            terapeutas={terapeutas.map((t) => ({
              id: t.id,
              nombre: `${t.apellidos}, ${t.nombres}`,
              refrigerioInicio: t.refrigerioInicio,
              refrigerioFin: t.refrigerioFin,
              especialidadIds: t.especialidades.map((e) => e.especialidadId),
              vacaciones: t.vacaciones.map((v) => ({
                inicio: claveFecha(v.fechaInicio),
                fin: claveFecha(v.fechaFin),
              })),
            }))}
            horaApertura={sede?.horaApertura ?? "09:00"}
            horaCierre={sede?.horaCierre ?? "13:00"}
            refrigerioInicio={sede?.refrigerioInicio ?? null}
            refrigerioFin={sede?.refrigerioFin ?? null}
            diasLaborales={sede?.diasLaborales ?? [1, 2, 3, 4, 5, 6]}
            intervaloCalendario={sede?.intervaloCalendario ?? 30}
            intervalosCalendario={sede?.intervalosCalendario ?? []}
            feriados={feriados.map((f) => claveFecha(f.fecha))}
            citas={citasFuturas.map((c) => ({
              terapeutaId: c.terapeutaId,
              pacienteId: c.pacienteId,
              terapiaId: c.terapiaId,
              clave: claveFecha(c.fecha),
              horaInicio: c.horaInicio,
              horaFin: c.horaFin,
            }))}
          />
        </Card>
      )}
    </div>
  );
}
