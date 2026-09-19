import { notFound } from "next/navigation";
import { requireUser, getCentro } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { LogoForm } from "./logo-form";

export default async function ConfiguracionLogoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();
  const [{ ok }, centro] = await Promise.all([searchParams, getCentro(user.centroId)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logo del centro"
        subtitle="Se muestra en el menú y en el encabezado de recibos, informes, historias y evaluaciones impresos."
      />
      <div className="max-w-xl">
        <Card>
          <LogoForm logoActualizadoEn={centro.logoActualizadoEn} guardado={ok === "1"} />
        </Card>
      </div>
    </div>
  );
}
