import Link from "next/link";
import { requireUser, requireActiveSede, getSedesForUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { soles } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  const sedes = await getSedesForUser(user);
  const sede = sedes.find((s) => s.id === sedeId);

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);
  const hoyFin = new Date();
  hoyFin.setHours(23, 59, 59, 999);

  const [pacientes, citasHoy, paquetesActivos, ingresosMes] = await Promise.all([
    prisma.paciente.count({ where: { sedeId, estado: "ACTIVO" } }),
    prisma.cita.count({
      where: { sedeId, fecha: { gte: hoyInicio, lte: hoyFin } },
    }),
    prisma.paquete.count({ where: { sedeId, estado: "ACTIVO" } }),
    prisma.pago.aggregate({
      where: { sedeId, fechaPago: { gte: inicioMes } },
      _sum: { monto: true },
    }),
  ]);

  const cards = [
    { label: "Pacientes activos", value: pacientes, href: "/pacientes", icon: "🧒" },
    { label: "Citas de hoy", value: citasHoy, href: "/citas", icon: "📅" },
    { label: "Paquetes activos", value: paquetesActivos, href: "/sesiones", icon: "📋" },
    {
      label: "Ingresos del mes",
      value: soles(ingresosMes._sum.monto ?? 0),
      href: "/pagos",
      icon: "💵",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Bienvenido, {user.nombre}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sede activa: <span className="font-medium">{sede?.nombre}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-3xl" aria-hidden>
                  {c.icon}
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {c.value}
              </p>
              <p className="text-sm text-slate-500">{c.label}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
