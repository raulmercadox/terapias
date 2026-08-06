import { notFound } from "next/navigation";
import { requireUser, requireActiveSede, puedeVerPagos } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { PacienteForm } from "../paciente-form";
import { crearPaciente } from "../actions";

export default async function NuevoPacientePage() {
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();
  // Garantiza sede activa válida antes de mostrar el formulario.
  await requireActiveSede(user);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrar nuevo paciente"
        subtitle="El paciente se registrará en la sede activa"
      />
      <PacienteForm action={crearPaciente} modo="crear" />
    </div>
  );
}
