import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUser,
  requireActiveSede,
  getSedesForUser,
  puedeVerPagos,
  puede,
  whereMisPacientes,
  type SessionUser,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState } from "@/components/ui";
import { nombreCompleto, soles } from "@/lib/utils";
import { contarPendientes } from "../seguimiento/consultas";
import { cobranzaDeSede } from "../pagos/consultas-cobranza";
import { WHERE_ES_PACIENTE, WHERE_ES_POTENCIAL } from "@/lib/tipo-paciente";

export default async function DashboardPage() {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  const sedes = await getSedesForUser(user);
  const sede = sedes.find((s) => s.id === sedeId);

  if (user.rol === "TERAPEUTA") {
    // Primer ingreso: antes de nada, que registre su firma.
    if (user.terapeuta && !user.terapeuta.tieneFirma) redirect("/mi-firma");
    return <InicioTerapeuta user={user} sedeId={sedeId} sedeNombre={sede?.nombre} />;
  }

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);
  const hoyFin = new Date();
  hoyFin.setHours(23, 59, 59, 999);

  // Los ingresos son información sensible: solo el administrador los ve.
  const esAdmin = user.rol === "ADMINISTRADOR";
  // El rol USUARIO no accede al módulo de pacientes.
  const vePacientes = user.rol !== "USUARIO";
  const vePagos = puedeVerPagos(user);

  const [pacientes, potenciales, porContactar, citasHoy, paquetesActivos, ingresosMes, cobranza] = await Promise.all([
    // Pacientes = ya en terapia; potenciales = evaluados que aún no empiezan.
    prisma.paciente.count({
      where: { sedeId, estado: "ACTIVO", AND: [WHERE_ES_PACIENTE] },
    }),
    vePacientes
      ? prisma.paciente.count({
          where: { sedeId, estado: "ACTIVO", AND: [WHERE_ES_POTENCIAL] },
        })
      : 0,
    vePacientes ? contarPendientes(sedeId) : 0,
    prisma.cita.count({
      where: { sedeId, fecha: { gte: hoyInicio, lte: hoyFin } },
    }),
    prisma.paquete.count({ where: { sedeId, estado: "ACTIVO" } }),
    esAdmin
      ? prisma.pago.aggregate({
          where: { sedeId, fechaPago: { gte: inicioMes } },
          _sum: { monto: true },
        })
      : null,
    vePagos ? cobranzaDeSede(sedeId, user.centroId) : null,
  ]);

  const cards = [
    ...(vePacientes
      ? [
          { label: "Pacientes activos", value: pacientes, href: "/pacientes", icon: "🧒" },
          {
            label: "Potenciales",
            value: potenciales,
            href: "/pacientes?tipo=potenciales",
            icon: "🌱",
          },
          { label: "Interesados por contactar", value: porContactar, href: "/seguimiento", icon: "📞" },
        ]
      : []),
    { label: "Citas de hoy", value: citasHoy, href: "/citas", icon: "📅" },
    { label: "Paquetes activos", value: paquetesActivos, href: "/sesiones", icon: "📋" },
    ...(cobranza
      ? [
          {
            label: "Pagos vencidos",
            value: cobranza.vencidos.length,
            href: "/pagos/cobranza",
            icon: "⏰",
          },
        ]
      : []),
    ...(ingresosMes
      ? [
          {
            label: "Ingresos del mes",
            value: soles(ingresosMes._sum.monto ?? 0),
            href: "/pagos",
            icon: "💵",
          },
        ]
      : []),
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

const ASISTENCIA_BADGE: Record<string, { label: string; color: "green" | "red" | "amber" | "slate" }> = {
  PENDIENTE: { label: "Pendiente", color: "slate" },
  ASISTIO: { label: "Asistió", color: "green" },
  TARDANZA: { label: "Tardanza", color: "amber" },
  FALTO: { label: "Faltó", color: "red" },
};

/** Inicio del terapeuta: sus citas de hoy y accesos a lo suyo. */
async function InicioTerapeuta({
  user,
  sedeId,
  sedeNombre,
}: {
  user: SessionUser;
  sedeId: string;
  sedeNombre?: string;
}) {
  const terapeutaId = user.terapeuta?.terapeutaId ?? "";
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);
  const hoyFin = new Date();
  hoyFin.setHours(23, 59, 59, 999);

  const [citasHoy, misPacientes] = await Promise.all([
    prisma.cita.findMany({
      where: {
        sedeId,
        terapeutaId,
        estado: { not: "CANCELADA" },
        fecha: { gte: hoyInicio, lte: hoyFin },
      },
      orderBy: { horaInicio: "asc" },
      select: {
        id: true,
        horaInicio: true,
        horaFin: true,
        asistencia: true,
        paciente: {
          select: { nombres: true, apellidoPaterno: true, apellidoMaterno: true },
        },
      },
    }),
    prisma.paciente.count({
      where: {
        sedeId,
        estado: "ACTIVO",
        AND: [whereMisPacientes(user), WHERE_ES_PACIENTE],
      },
    }),
  ]);

  const cards = [
    { label: "Mis citas de hoy", value: citasHoy.length, href: "/citas", icon: "📅" },
    { label: "Mis pacientes activos", value: misPacientes, href: "/pacientes", icon: "🧒" },
    ...(puede(user, "CITA_AL_VUELO")
      ? [{ label: "Registrar cita al vuelo", value: "⚡", href: "/citas/rapida", icon: "➕" }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Bienvenido, {user.nombre}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sede: <span className="font-medium">{sedeNombre}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="transition-shadow hover:shadow-md">
              <span className="text-3xl" aria-hidden>
                {c.icon}
              </span>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {c.value}
              </p>
              <p className="text-sm text-slate-500">{c.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Hoy
        </h2>
        {citasHoy.length === 0 ? (
          <EmptyState message="No tienes citas para hoy." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {citasHoy.map((c) => {
              const a = ASISTENCIA_BADGE[c.asistencia] ?? ASISTENCIA_BADGE.PENDIENTE;
              return (
                <li key={c.id}>
                  <Link
                    href={`/citas/${c.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
                  >
                    <span className="text-sm">
                      <span className="font-medium text-slate-900">
                        {c.horaInicio}–{c.horaFin}
                      </span>{" "}
                      · {nombreCompleto(c.paciente)}
                    </span>
                    <Badge color={a.color}>{a.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
