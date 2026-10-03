import { notFound } from "next/navigation";
import { esTerapeuta, puede, requireUser, terapeutaDe } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { fecha, horaLima, hoyLima, nombreCompleto } from "@/lib/utils";
import { CitaRapidaForm } from "./cita-rapida-form";

/** Registro al vuelo: cita de hoy, para el propio terapeuta, en una pantalla. */
export default async function CitaRapidaPage() {
  const user = await requireUser();
  if (!esTerapeuta(user) || !user.terapeuta || !puede(user, "CITA_AL_VUELO")) {
    notFound();
  }
  const { sedeId } = terapeutaDe(user);

  const pacientes = await prisma.paciente.findMany({
    where: { sedeId, estado: "ACTIVO" },
    orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
    select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro rápido"
        subtitle={`Cita para hoy, ${fecha(`${hoyLima()}T12:00:00Z`)}, a tu nombre.`}
      />
      <Card className="max-w-2xl">
        <CitaRapidaForm
          pacientes={pacientes.map((p) => ({ id: p.id, nombre: nombreCompleto(p) }))}
          horaInicial={horaLima()}
          puedeCrearPaciente={puede(user, "PACIENTE_AL_VUELO")}
        />
      </Card>
    </div>
  );
}
