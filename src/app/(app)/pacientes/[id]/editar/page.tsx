import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto } from "@/lib/utils";
import { PacienteForm, type PacienteInicial } from "../../paciente-form";
import { actualizarPaciente } from "../../actions";

function toInputDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const paciente = await prisma.paciente.findUnique({ where: { id } });
  if (!paciente || !(await canAccessSede(user, paciente.sedeId))) notFound();

  const inicial: PacienteInicial = {
    nombres: paciente.nombres,
    apellidoPaterno: paciente.apellidoPaterno,
    apellidoMaterno: paciente.apellidoMaterno,
    dni: paciente.dni,
    fechaNacimiento: toInputDate(paciente.fechaNacimiento),
    sexo: paciente.sexo,
    telefono: paciente.telefono,
    correo: paciente.correo,
    direccion: paciente.direccion,
    distrito: paciente.distrito,
    fotoUrl: paciente.fotoUrl,
    programa: paciente.programa,
    diagnostico: paciente.diagnostico,
    observaciones: paciente.observaciones,
  };

  const action = actualizarPaciente.bind(null, paciente.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar paciente"
        subtitle={nombreCompleto(paciente)}
      />
      <PacienteForm action={action} inicial={inicial} modo="editar" />
    </div>
  );
}
