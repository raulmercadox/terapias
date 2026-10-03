import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { UsuarioForm } from "../usuario-form";
import { terapeutasVinculables } from "../terapeutas-vinculables";

export default async function NuevoUsuarioPage() {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const [sedes, terapeutas] = await Promise.all([
    prisma.sede.findMany({
      where: { centroId: user.centroId, activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    terapeutasVinculables(user.centroId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo usuario" subtitle="Crea una cuenta de acceso." />
      <Card>
        <UsuarioForm sedes={sedes} terapeutas={terapeutas} />
      </Card>
    </div>
  );
}
