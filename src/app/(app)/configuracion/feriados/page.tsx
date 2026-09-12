import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Card,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { fecha as fmtFecha } from "@/lib/utils";
import { FeriadoForm, EliminarFeriadoBtn } from "./feriado-form";

export default async function FeriadosPage({
  searchParams,
}: PageProps<"/configuracion/feriados">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const { sede } = await searchParams;
  const sedeParam = typeof sede === "string" ? sede : undefined;

  const sedes = await prisma.sede.findMany({
    where: { centroId: user.centroId, activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });

  if (sedes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Feriados"
          subtitle="Días no disponibles para sesiones."
        />
        <EmptyState message="No hay sedes activas. Crea una sede primero." />
      </div>
    );
  }

  const seleccionada = sedes.find((s) => s.id === sedeParam) ?? sedes[0];

  const feriados = await prisma.feriado.findMany({
    where: { sedeId: seleccionada.id },
    orderBy: { fecha: "asc" },
    select: { id: true, fecha: true, descripcion: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feriados"
        subtitle="Días no disponibles para sesiones. Al generar un paquete se saltan automáticamente."
      />

      {/* Selector de sede */}
      <div className="flex flex-wrap gap-2">
        {sedes.map((s) => (
          <Link
            key={s.id}
            href={`/configuracion/feriados?sede=${s.id}`}
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {feriados.length === 0 ? (
            <EmptyState message="No hay feriados registrados en esta sede." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Descripción</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {feriados.map((f) => (
                  <tr key={f.id}>
                    <Td className="font-medium text-slate-900">
                      {fmtFecha(f.fecha)}
                    </Td>
                    <Td>{f.descripcion ?? "—"}</Td>
                    <Td className="text-right">
                      <EliminarFeriadoBtn id={f.id} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        <div>
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Nuevo feriado · {seleccionada.nombre}
            </h2>
            <FeriadoForm sedeId={seleccionada.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
