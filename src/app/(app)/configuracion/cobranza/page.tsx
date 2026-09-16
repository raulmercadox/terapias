import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { Card, PageHeader } from "@/components/ui";
import { CobranzaForm } from "./cobranza-form";

export default async function ConfiguracionCobranzaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();
  const [{ ok }, config] = await Promise.all([
    searchParams,
    obtenerConfiguracion(user.centroId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobranza"
        subtitle="Plazo para pagar los paquetes de sesiones. Aplica a todas las sedes del centro."
      />
      <div className="max-w-xl">
        <Card>
          <CobranzaForm
            config={{
              graciaTipo: config.graciaTipo,
              graciaValor: config.graciaValor,
              diasAvisoCobro: config.diasAvisoCobro,
            }}
            guardado={ok === "1"}
          />
        </Card>
      </div>
    </div>
  );
}
