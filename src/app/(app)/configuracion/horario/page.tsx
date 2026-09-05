import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser, requireActiveSede } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { HorarioForm } from "./horario-form";

export default async function HorarioPage({
  searchParams,
}: PageProps<"/configuracion/horario">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();
  const sedeActivaId = await requireActiveSede(user);

  const { sede, ok } = await searchParams;
  const sedeParam = typeof sede === "string" ? sede : undefined;

  const sedes = await prisma.sede.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      horaApertura: true,
      horaCierre: true,
      refrigerioInicio: true,
      refrigerioFin: true,
      diasLaborales: true,
      intervaloCalendario: true,
      intervalosCalendario: true,
    },
  });

  if (sedes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Horario de atención"
          subtitle="Días y horas en que cada sede atiende."
        />
        <EmptyState message="No hay sedes activas. Crea una sede primero." />
      </div>
    );
  }

  // Sin ?sede= en la URL se abre la sede activa del usuario, no la primera
  // alfabética (editar otra sede sin darse cuenta es un error fácil).
  const seleccionada =
    sedes.find((s) => s.id === sedeParam) ??
    sedes.find((s) => s.id === sedeActivaId) ??
    sedes[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horario de atención"
        subtitle="Días y horas en que cada sede atiende. Acota los intervalos disponibles al agendar."
      />

      {/* Selector de sede */}
      <div className="flex flex-wrap gap-2">
        {sedes.map((s) => (
          <Link
            key={s.id}
            href={`/configuracion/horario?sede=${s.id}`}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              s.id === seleccionada.id
                ? "border-sky-500 bg-sky-50 text-sky-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s.nombre}
          </Link>
        ))}
      </div>

      <div className="max-w-xl">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {seleccionada.nombre}
          </h2>
          <HorarioForm
            key={seleccionada.id}
            sede={seleccionada}
            guardado={ok === "1"}
          />
        </Card>
      </div>
    </div>
  );
}
