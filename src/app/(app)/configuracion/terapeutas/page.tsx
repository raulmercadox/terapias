import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  fecha as fmtFecha,
  fechaHora as fmtFechaHora,
  nombreCompleto,
} from "@/lib/utils";
import { TerapeutaForm } from "./terapeuta-form";
import { VacacionForm, EliminarVacacionBtn } from "./vacaciones-form";
import { BorrarFirmaBtn } from "./borrar-firma-btn";

/** Día siguiente a una fecha de medianoche (tope exclusivo de un rango). */
function diaSiguiente(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + 1);
  return x;
}

export default async function TerapeutasPage({
  searchParams,
}: PageProps<"/configuracion/terapeutas">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const { editar, vacacion } = await searchParams;
  const editarId = typeof editar === "string" ? editar : undefined;
  const vacacionId = typeof vacacion === "string" ? vacacion : undefined;

  const [terapeutas, sedes, catalogoEspecialidades] = await Promise.all([
    prisma.terapeuta.findMany({
      where: { sede: { centroId: user.centroId } },
      orderBy: [{ activo: "desc" }, { apellidos: "asc" }],
      // La firma (data URL) solo se carga para el terapeuta en edición.
      omit: { firma: true },
      include: {
        sede: { select: { nombre: true } },
        usuario: { select: { usuario: true } },
        especialidades: {
          orderBy: { especialidad: { nombre: "asc" } },
          select: { especialidad: { select: { id: true, nombre: true } } },
        },
      },
    }),
    prisma.sede.findMany({
      where: { centroId: user.centroId, activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    prisma.especialidad.findMany({
      where: { centroId: user.centroId },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, activo: true },
    }),
  ]);

  const terapeutaEnEdicion = editarId
    ? terapeutas.find((t) => t.id === editarId)
    : undefined;
  const firmaEnEdicion = terapeutaEnEdicion?.firmaActualizadaEn
    ? (
        await prisma.terapeuta.findUnique({
          where: { id: terapeutaEnEdicion.id },
          select: { firma: true },
        })
      )?.firma
    : null;
  const especialidadIdsEnEdicion =
    terapeutaEnEdicion?.especialidades.map((te) => te.especialidad.id) ?? [];

  // Para asignar solo se ofrecen las activas; las inactivas que el terapeuta
  // ya tiene se muestran igual para no perderlas al guardar.
  const especialidadesOpciones = catalogoEspecialidades.filter(
    (e) => e.activo || especialidadIdsEnEdicion.includes(e.id),
  );

  // Vacaciones del terapeuta en edición, con cuántas sesiones siguen agendadas
  // dentro de cada rango (hay que reprogramarlas o reasignarlas a mano).
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vacaciones = terapeutaEnEdicion
    ? await prisma.vacacionTerapeuta.findMany({
        where: { terapeutaId: terapeutaEnEdicion.id, fechaFin: { gte: hoy } },
        orderBy: { fechaInicio: "asc" },
      })
    : [];
  const citasEnVacaciones = terapeutaEnEdicion
    ? await Promise.all(
        vacaciones.map((v) =>
          prisma.cita.findMany({
            where: {
              terapeutaId: terapeutaEnEdicion.id,
              estado: { not: "CANCELADA" },
              fecha: { gte: v.fechaInicio, lt: diaSiguiente(v.fechaFin) },
            },
            orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
            select: {
              id: true,
              fecha: true,
              horaInicio: true,
              horaFin: true,
              paqueteId: true,
              paciente: {
                select: {
                  nombres: true,
                  apellidoPaterno: true,
                  apellidoMaterno: true,
                },
              },
            },
          }),
        ),
      )
    : [];
  const iRecienCreada = vacaciones.findIndex((v) => v.id === vacacionId);
  const afectadas = iRecienCreada >= 0 ? citasEnVacaciones[iRecienCreada] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terapeutas"
        subtitle="Profesionales que atienden en cada sede."
      />

      {sedes.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No hay sedes activas. Crea una sede antes de registrar terapeutas.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {terapeutas.length === 0 ? (
            <EmptyState message="No hay terapeutas registrados." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Sede</Th>
                  <Th>Especialidades</Th>
                  <Th>Teléfono</Th>
                  <Th>Refrigerio</Th>
                  <Th>Usuario</Th>
                  <Th>Estado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terapeutas.map((t) => (
                  <tr key={t.id}>
                    <Td className="font-medium text-slate-900">
                      {t.apellidos}, {t.nombres}
                    </Td>
                    <Td>{t.sede.nombre}</Td>
                    <Td>
                      {t.especialidades.length > 0
                        ? t.especialidades
                            .map((te) => te.especialidad.nombre)
                            .join(", ")
                        : "—"}
                    </Td>
                    <Td>{t.telefono ?? "—"}</Td>
                    <Td>
                      {t.refrigerioInicio && t.refrigerioFin ? (
                        `${t.refrigerioInicio}–${t.refrigerioFin}`
                      ) : (
                        <span className="text-slate-400">De la sede</span>
                      )}
                    </Td>
                    <Td>
                      {t.usuario ? (
                        <>
                          <span className="block">{t.usuario.usuario}</span>
                          <span
                            className={
                              t.firmaActualizadaEn
                                ? "text-xs text-green-700"
                                : "text-xs text-amber-700"
                            }
                          >
                            {t.firmaActualizadaEn
                              ? "Firma registrada"
                              : "Firma pendiente"}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">Sin usuario</span>
                      )}
                    </Td>
                    <Td>
                      {t.activo ? (
                        <Badge color="green">Activo</Badge>
                      ) : (
                        <Badge color="red">Inactivo</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <ButtonLink
                        href={`/configuracion/terapeutas?editar=${t.id}`}
                        variant="ghost"
                      >
                        Editar
                      </ButtonLink>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        <div>
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {terapeutaEnEdicion ? "Editar terapeuta" : "Nuevo terapeuta"}
            </h2>
            <TerapeutaForm
              key={terapeutaEnEdicion?.id ?? "nuevo"}
              sedes={sedes}
              especialidades={especialidadesOpciones}
              terapeuta={
                terapeutaEnEdicion
                  ? {
                      id: terapeutaEnEdicion.id,
                      sedeId: terapeutaEnEdicion.sedeId,
                      nombres: terapeutaEnEdicion.nombres,
                      apellidos: terapeutaEnEdicion.apellidos,
                      especialidadIds: especialidadIdsEnEdicion,
                      telefono: terapeutaEnEdicion.telefono,
                      activo: terapeutaEnEdicion.activo,
                      refrigerioInicio: terapeutaEnEdicion.refrigerioInicio,
                      refrigerioFin: terapeutaEnEdicion.refrigerioFin,
                    }
                  : undefined
              }
            />
          </Card>

          {terapeutaEnEdicion && (
            <Card className="mt-6">
              <h2 className="mb-1 text-lg font-semibold text-slate-900">
                Firma
              </h2>
              <p className="mb-4 text-xs text-slate-400">
                La dibuja el propio terapeuta al entrar con su usuario. Se usará
                al firmar informes y evaluaciones.
              </p>
              {firmaEnEdicion ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
                  <img
                    src={firmaEnEdicion}
                    alt={`Firma de ${terapeutaEnEdicion.nombres} ${terapeutaEnEdicion.apellidos}`}
                    className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain p-2"
                  />
                  {terapeutaEnEdicion.firmaActualizadaEn && (
                    <p className="text-xs text-slate-500">
                      Registrada el {fmtFechaHora(terapeutaEnEdicion.firmaActualizadaEn)}
                    </p>
                  )}
                  <BorrarFirmaBtn id={terapeutaEnEdicion.id} />
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {terapeutaEnEdicion.usuario
                    ? "Aún no registra su firma. Se le pedirá al entrar."
                    : "Sin firma. Crea un usuario con rol Terapeuta para que pueda registrarla."}
                </p>
              )}
            </Card>
          )}

          {terapeutaEnEdicion && (
            <Card className="mt-6">
              <h2 className="mb-1 text-lg font-semibold text-slate-900">
                Vacaciones
              </h2>
              <p className="mb-4 text-xs text-slate-400">
                En estos días no se le pueden agendar sesiones ni citas.
              </p>

              {afectadas.length > 0 && (
                <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p className="font-medium">
                    Vacaciones guardadas, pero el terapeuta ya tiene{" "}
                    {afectadas.length} sesión(es) en esas fechas. Reprográmalas
                    o asígnalas a otro terapeuta:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {afectadas.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={
                            c.paqueteId
                              ? `/sesiones/${c.paqueteId}`
                              : `/citas/${c.id}`
                          }
                          className="underline hover:text-amber-900"
                        >
                          {fmtFecha(c.fecha)} · {c.horaInicio}–{c.horaFin} ·{" "}
                          {nombreCompleto(c.paciente)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {vacaciones.length === 0 ? (
                <p className="mb-4 text-sm text-slate-500">
                  Sin vacaciones programadas.
                </p>
              ) : (
                <ul className="mb-4 divide-y divide-slate-100">
                  {vacaciones.map((v, i) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-2 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {fmtFecha(v.fechaInicio)}
                          {v.fechaFin.getTime() !== v.fechaInicio.getTime() &&
                            ` – ${fmtFecha(v.fechaFin)}`}
                        </p>
                        {v.descripcion && (
                          <p className="text-xs text-slate-500">
                            {v.descripcion}
                          </p>
                        )}
                        {citasEnVacaciones[i].length > 0 && (
                          <p className="text-xs text-amber-700">
                            {citasEnVacaciones[i].length} sesión(es) por
                            reprogramar
                          </p>
                        )}
                      </div>
                      <EliminarVacacionBtn id={v.id} />
                    </li>
                  ))}
                </ul>
              )}

              <VacacionForm terapeutaId={terapeutaEnEdicion.id} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
