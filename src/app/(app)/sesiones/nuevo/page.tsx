import { requireUser, requireActiveSede } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, ButtonLink, Card, EmptyState } from "@/components/ui";
import { nombreCompleto } from "@/lib/utils";
import { claveFecha } from "../horario";
import NuevoPaqueteForm from "./form";

export default async function NuevoPaquetePage() {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  // Horizonte para el calendario de disponibilidad (~1 año: el usuario navega
  // semana a semana marcando sesiones concretas).
  const horizonte = new Date(hoy);
  horizonte.setDate(horizonte.getDate() + 430);

  const [pacientes, terapeutas, programas, sede, feriados, citasFuturas] =
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
    prisma.terapeuta.findMany({
      where: { sedeId, activo: true },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: { id: true, nombres: true, apellidos: true },
    }),
    prisma.programaTerapia.findMany({
      where: { sedeId, activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, duracionMin: true, maxPacientes: true },
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
        fecha: true,
        horaInicio: true,
        horaFin: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo paquete"
        subtitle="Elige el programa y el horario de cada día; las sesiones se generan automáticamente."
        actions={
          <ButtonLink href="/sesiones" variant="secondary">
            Volver
          </ButtonLink>
        }
      />

      {pacientes.length === 0 ? (
        <EmptyState message="No hay pacientes activos en esta sede. Registre un paciente antes de crear un paquete." />
      ) : programas.length === 0 ? (
        <EmptyState message="No hay programas configurados en esta sede. Cree un programa (con su duración) en Configuración › Programas antes de crear un paquete." />
      ) : terapeutas.length === 0 ? (
        <EmptyState message="No hay terapeutas activos en esta sede. Registre un terapeuta en Configuración › Terapeutas antes de crear un paquete." />
      ) : (
        <Card className="max-w-2xl">
          <NuevoPaqueteForm
            sedeId={sedeId}
            pacientes={pacientes.map((p) => ({
              id: p.id,
              nombre: nombreCompleto(p),
            }))}
            terapeutas={terapeutas.map((t) => ({
              id: t.id,
              nombre: `${t.apellidos}, ${t.nombres}`,
            }))}
            programas={programas}
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
              dia: c.fecha.getDay(),
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
