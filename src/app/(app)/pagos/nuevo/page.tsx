import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { requireUser, requireActiveSede, puedeVerPagos } from "@/lib/session";
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

export default async function NuevoPagoPage({
  searchParams,
}: {
  // Desde Cobranza se llega con el paciente y el paquete ya elegidos.
  searchParams: Promise<{ pacienteId?: string; paqueteId?: string }>;
}) {
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();
  const sedeId = await requireActiveSede(user);
  const sp = await searchParams;

  const [pacientesRaw, paquetesRaw, pagosPorPaquete] = await Promise.all([
    prisma.paciente.findMany({
      where: {
        sedeId,
        // El paciente precargado entra aunque ya no esté activo (puede deber).
        OR: [{ estado: "ACTIVO" }, ...(sp.pacienteId ? [{ id: sp.pacienteId }] : [])],
      },
      orderBy: [{ apellidoPaterno: "asc" }, { nombres: "asc" }],
      select: {
        id: true,
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
      },
    }),
    // No anulados: un paquete completado que todavía debe también se cobra.
    prisma.paquete.findMany({
      where: { sedeId, estado: { not: "ANULADO" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        pacienteId: true,
        totalSesiones: true,
        precio: true,
        fechaInicio: true,
        estado: true,
      },
    }),
    // Total ya pagado por cada paquete de la sede (para calcular el saldo).
    prisma.pago.groupBy({
      by: ["paqueteId"],
      where: { sedeId, paqueteId: { not: null } },
      _sum: { monto: true },
    }),
  ]);

  const pagadoPorPaquete = new Map(
    pagosPorPaquete.map((g) => [g.paqueteId, Number(g._sum.monto ?? 0)]),
  );

  const pacientes = pacientesRaw.map((p) => ({
    id: p.id,
    nombre: nombreCompleto(p),
  }));

  const paquetes = paquetesRaw
    // Activos, más los que no están activos pero tienen saldo pendiente.
    .filter(
      (p) =>
        p.estado === "ACTIVO" || (pagadoPorPaquete.get(p.id) ?? 0) < Number(p.precio),
    )
    .map((p) => ({
      id: p.id,
      pacienteId: p.pacienteId,
      precio: Number(p.precio),
      pagado: pagadoPorPaquete.get(p.id) ?? 0,
      etiqueta: `${p.totalSesiones} sesiones · ${soles(p.precio)}${
        p.fechaInicio ? ` · ${fecha(p.fechaInicio)}` : ""
      }`,
    }));

  // Solo se precarga lo que existe en las listas (y el paquete, si es del paciente).
  const pacienteInicial = pacientes.some((p) => p.id === sp.pacienteId)
    ? sp.pacienteId
    : undefined;
  const paqueteInicial = paquetes.some(
    (p) => p.id === sp.paqueteId && p.pacienteId === pacienteInicial,
  )
    ? sp.paqueteId
    : undefined;

  return (
    <>
      <PageHeader
        title="Registrar pago"
        subtitle="Genera un recibo interno para la sede activa."
      />

      {pacientes.length === 0 ? (
        <EmptyState message="No hay pacientes activos en esta sede. Registra un paciente antes de cobrar." />
      ) : (
        <PagoForm
          pacientes={pacientes}
          paquetes={paquetes}
          hoy={hoyISO()}
          inicial={{ pacienteId: pacienteInicial, paqueteId: paqueteInicial }}
        />
      )}
    </>
  );
}
