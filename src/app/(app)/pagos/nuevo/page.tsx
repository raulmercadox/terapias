import { prisma } from "@/lib/prisma";
import { requireUser, requireActiveSede } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/ui";
import { nombreCompleto, fecha, soles } from "@/lib/utils";
import { PagoForm } from "./pago-form";

/** "YYYY-MM-DD" de hoy (zona local). */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function NuevoPagoPage() {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);

  const [pacientesRaw, paquetesRaw] = await Promise.all([
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
    prisma.paquete.findMany({
      where: { sedeId, estado: "ACTIVO" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        pacienteId: true,
        totalSesiones: true,
        precio: true,
        fechaInicio: true,
      },
    }),
  ]);

  const pacientes = pacientesRaw.map((p) => ({
    id: p.id,
    nombre: nombreCompleto(p),
  }));

  const paquetes = paquetesRaw.map((p) => ({
    id: p.id,
    pacienteId: p.pacienteId,
    etiqueta: `${p.totalSesiones} sesiones · ${soles(p.precio)}${
      p.fechaInicio ? ` · ${fecha(p.fechaInicio)}` : ""
    }`,
  }));

  return (
    <>
      <PageHeader
        title="Registrar pago"
        subtitle="Genera un recibo interno para la sede activa."
      />

      {pacientes.length === 0 ? (
        <EmptyState message="No hay pacientes activos en esta sede. Registra un paciente antes de cobrar." />
      ) : (
        <PagoForm pacientes={pacientes} paquetes={paquetes} hoy={hoyISO()} />
      )}
    </>
  );
}
