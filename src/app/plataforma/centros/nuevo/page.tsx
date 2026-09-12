import { requireSuperadmin } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { CentroForm } from "../../centro-form";

export default async function NuevoCentroPage() {
  await requireSuperadmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo centro"
        subtitle="Se crea con su primera sede y su usuario administrador."
      />
      <Card>
        <CentroForm />
      </Card>
    </div>
  );
}
