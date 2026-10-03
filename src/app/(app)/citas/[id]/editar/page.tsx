import { notFound, redirect } from "next/navigation";
import {
  requireUser,
  canAccessSede,
  esCitaPropia,
  esTerapeuta,
  puede,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { nombreCompleto } from "@/lib/utils";
import { CitaForm } from "../../cita-form";
import { aISO } from "../../helpers";

export default async function EditarCitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const cita = await prisma.cita.findUnique({ where: { id } });
  if (!cita) notFound();
  if (!(await canAccessSede(user, cita.sedeId))) redirect("/citas");
  // El terapeuta (con MOVER_CITAS) solo cambia fecha y hora de sus citas: se
  // le ofrecen únicamente el paciente y el terapeuta actuales.
  const terapeuta = esTerapeuta(user);
  if (!esCitaPropia(user, cita) || !puede(user, "MOVER_CITAS")) notFound();

  const [pacientes, terapeutas] = await Promise.all([
    prisma.paciente.findMany({
      where: terapeuta
        ? { id: cita.pacienteId }
        : { sedeId: cita.sedeId, estado: "ACTIVO" },
      orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
      select: {
        id: true,
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
      },
    }),
    prisma.terapeuta.findMany({
      where: terapeuta
        ? { id: cita.terapeutaId ?? "" }
        : { sedeId: cita.sedeId, activo: true },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: { id: true, nombres: true, apellidos: true },
    }),
  ]);

  // El paciente actual puede no estar en la lista de ACTIVOS (p. ej. dado de baja).
  // Lo incluimos para que el select siempre muestre el valor guardado.
  const pacienteActual = pacientes.find((p) => p.id === cita.pacienteId);
  let opcionesPacientes = pacientes.map((p) => ({
    id: p.id,
    nombre: nombreCompleto(p),
  }));
  if (!pacienteActual) {
    const extra = await prisma.paciente.findUnique({
      where: { id: cita.pacienteId },
      select: {
        id: true,
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
      },
    });
    if (extra) {
      opcionesPacientes = [
        { id: extra.id, nombre: `${nombreCompleto(extra)} (inactivo)` },
        ...opcionesPacientes,
      ];
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={terapeuta ? "Mover cita" : "Editar cita"}
        subtitle={
          terapeuta
            ? "Cambia la fecha y la hora de la cita."
            : "Modifica los datos de la cita."
        }
      />
      <Card className="max-w-2xl">
        <CitaForm
          pacientes={opcionesPacientes}
          terapeutas={terapeutas.map((t) => ({
            id: t.id,
            nombre: `${t.apellidos} ${t.nombres}`,
          }))}
          inicial={{
            id: cita.id,
            pacienteId: cita.pacienteId,
            terapeutaId: cita.terapeutaId,
            fecha: aISO(cita.fecha),
            horaInicio: cita.horaInicio,
            horaFin: cita.horaFin,
            tipo: cita.tipo,
            observacion: cita.observacion,
          }}
        />
      </Card>
    </div>
  );
}
