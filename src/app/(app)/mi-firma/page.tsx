import { notFound } from "next/navigation";
import { esTerapeuta, requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { fechaHora } from "@/lib/utils";
import { FirmaForm } from "./firma-form";

export default async function MiFirmaPage({
  searchParams,
}: PageProps<"/mi-firma">) {
  const user = await requireUser();
  if (!esTerapeuta(user)) notFound();
  if (!user.terapeuta) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mi firma" />
        <EmptyState message="Tu usuario no está vinculado a un terapeuta activo. Comunícate con el administrador." />
      </div>
    );
  }

  const { guardada } = await searchParams;
  const terapeuta = await prisma.terapeuta.findUnique({
    where: { id: user.terapeuta.terapeutaId },
    select: { firma: true, firmaActualizadaEn: true },
  });
  const firma = terapeuta?.firma ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi firma"
        subtitle="Se usará al firmar tus informes de avance y evaluaciones."
      />

      {guardada && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Firma actualizada.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {firma && (
          <Card>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">
              Firma registrada
            </h2>
            {terapeuta?.firmaActualizadaEn && (
              <p className="mb-4 text-xs text-slate-400">
                Desde el {fechaHora(terapeuta.firmaActualizadaEn)}
              </p>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
            <img
              src={firma}
              alt="Tu firma registrada"
              className="h-32 w-full rounded-lg border border-slate-200 bg-white object-contain p-2"
            />
          </Card>
        )}

        <Card className={firma ? undefined : "lg:col-span-2"}>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            {firma ? "Cambiar firma" : "Registra tu firma"}
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            {firma
              ? "Dibuja la nueva firma: reemplaza a la anterior."
              : "Antes de empezar, dibuja tu firma tal como la harías en papel."}
          </p>
          <FirmaForm tieneFirma={!!firma} />
        </Card>
      </div>
    </div>
  );
}
