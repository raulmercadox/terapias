import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireUser,
  canAccessSede,
  puedeVerPagos,
  esTerapeuta,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  ButtonLink,
  Card,
  Table,
  Th,
  Badge,
} from "@/components/ui";
import { soles, fecha, nombreCompleto, hoyLima } from "@/lib/utils";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { claveFecha } from "../horario";
import {
  COBRO_COLOR,
  evaluarCobro,
  fechaDeISO,
  reglaDeConfiguracion,
  textoCobro,
} from "../../pagos/cobranza";
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
  // El terapeuta no gestiona paquetes ni agenda citas libremente.
  if (esTerapeuta(user)) notFound();
  // El rol USUARIO no ve montos (información de pagos).
  const veMontos = puedeVerPagos(user);

  const paquete = await prisma.paquete.findUnique({
    where: { id },
    select: {
      id: true,
      sedeId: true,
      pacienteId: true,
      evaluacionId: true,
      evaluacion: { select: { fecha: true } },
      totalSesiones: true,
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
      terapias: {
        orderBy: { orden: "asc" },
        select: {
          id: true,
          totalSesiones: true,
          frecuenciaSemana: true,
          terapia: {
            select: {
              nombre: true,
              especialidadId: true,
              modalidad: true,
              maxParticipantes: true,
              duracionMin: true,
            },
          },
          terapeuta: { select: { nombres: true, apellidos: true } },
        },
      },
      citas: {
        where: { tipo: "SESION" },
        orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
        select: {
          id: true,
          paqueteTerapiaId: true,
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
    select: {
      id: true,
      nombres: true,
      apellidos: true,
      especialidades: { select: { especialidadId: true } },
    },
  });
  /** Terapeutas que pueden atender la terapia (por su especialidad). */
  const terapeutasPara = (especialidadId: string | null | undefined) =>
    terapeutas
      .filter(
        (t) =>
          !especialidadId ||
          t.especialidades.some((e) => e.especialidadId === especialidadId),
      )
      .map((t) => ({
        id: t.id,
        nombre: `${t.apellidos}, ${t.nombres}`,
      }));

  // Sesiones agrupadas por terapia del paquete (las sueltas, si las hubiera,
  // van al final).
  const grupos = [
    ...paquete.terapias.map((l) => ({
      id: l.id,
      titulo: l.terapia?.nombre ?? "Terapia",
      detalle: [
        l.terapeuta ? `${l.terapeuta.apellidos}, ${l.terapeuta.nombres}` : "Sin terapeuta",
        `${l.frecuenciaSemana} por semana`,
        l.terapia?.modalidad === "GRUPAL"
          ? `grupal (máx. ${l.terapia.maxParticipantes})`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      total: l.totalSesiones,
      especialidadId: l.terapia?.especialidadId,
      duracionMin: l.terapia?.duracionMin,
      citas: paquete.citas.filter((c) => c.paqueteTerapiaId === l.id),
    })),
    {
      id: "otras",
      titulo: "Otras sesiones",
      detalle: "",
      total: 0,
      especialidadId: null,
      duracionMin: undefined,
      citas: paquete.citas.filter((c) => !c.paqueteTerapiaId),
    },
  ].filter((g) => g.id !== "otras" || g.citas.length > 0);

  // Estado de pago (solo para quien ve montos): saldo y plazo según Cobranza,
  // que se configura por centro.
  const [pagado, config] = veMontos
    ? await Promise.all([
        prisma.pago.aggregate({ where: { paqueteId: paquete.id }, _sum: { monto: true } }),
        obtenerConfiguracion(user.centroId),
      ])
    : [null, null];
  const hoy = hoyLima();
  const cobro =
    pagado && config
      ? {
          pagado: Number(pagado._sum.monto ?? 0),
          ...evaluarCobro(
            {
              precio: Number(paquete.precio),
              pagado: Number(pagado._sum.monto ?? 0),
              fechaInicio: paquete.fechaInicio ? claveFecha(paquete.fechaInicio) : null,
              fechaFin: paquete.fechaFin ? claveFecha(paquete.fechaFin) : null,
            },
            reglaDeConfiguracion(config),
            hoy,
          ),
        }
      : null;

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
        subtitle={`${paquete.totalSesiones} sesiones · ${paquete.terapias
          .map((l) => l.terapia?.nombre ?? "Terapia")
          .join(", ")}`}
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
            {cobro && (
              <>
                <Dato label="Pagado">{soles(cobro.pagado)}</Dato>
                <Dato label="Saldo">
                  {cobro.saldo > 0 ? (
                    soles(cobro.saldo)
                  ) : (
                    <Badge color="green">Pagado</Badge>
                  )}
                </Dato>
                {cobro.saldo > 0 && cobro.limiteISO && (
                  <Dato label="Fecha límite de pago">
                    {cobro.estado ? (
                      <Badge color={COBRO_COLOR[cobro.estado]}>
                        {textoCobro(cobro.estado, cobro.limiteISO, hoy)}
                      </Badge>
                    ) : (
                      fechaDeISO(cobro.limiteISO)
                    )}
                  </Dato>
                )}
              </>
            )}
            <Dato label="Inicio">{fecha(paquete.fechaInicio)}</Dato>
            <Dato label="Fin estimado">{fecha(paquete.fechaFin)}</Dato>
            <Dato label="Evaluación">
              {paquete.evaluacionId && paquete.evaluacion ? (
                <Link
                  href={`/pacientes/${paquete.pacienteId}/evaluaciones/${paquete.evaluacionId}`}
                  className="text-sky-700 hover:underline"
                >
                  Del {fecha(paquete.evaluacion.fecha)}
                </Link>
              ) : (
                "—"
              )}
            </Dato>
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

      {grupos.map((g) => {
        const usadasGrupo = g.citas.filter((c) => c.asistencia !== "PENDIENTE").length;
        return (
          <div key={g.id}>
            <h2 className="text-lg font-semibold text-slate-900">{g.titulo}</h2>
            <p className="mb-3 text-sm text-slate-500">
              {[g.detalle, g.total ? `${usadasGrupo} / ${g.total} sesiones usadas` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
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
                {g.citas.map((c) => (
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
                    terapeutas={terapeutasPara(g.especialidadId)}
                    duracionMin={g.duracionMin}
                    asistenciaColor={asistenciaColor[c.asistencia]}
                    asistenciaLabel={asistenciaLabel[c.asistencia]}
                  />
                ))}
              </tbody>
            </Table>
          </div>
        );
      })}
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
