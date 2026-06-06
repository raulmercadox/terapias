import { EmptyState, PageHeader } from "@/components/ui";

export default function SinSedePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Sin sede asignada" />
      <EmptyState message="Tu usuario no tiene ninguna sede asignada. Comunícate con el administrador para que te asigne una sede." />
    </div>
  );
}
