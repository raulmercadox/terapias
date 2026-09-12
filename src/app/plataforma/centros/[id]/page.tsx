import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { CentroForm } from "../../centro-form";
import { ClaveForm } from "../../clave-form";

export default async function EditarCentroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperadmin();
  const { id } = await params;

  const centro = await prisma.centro.findUnique({
    where: { id },
    include: {
      usuarios: {
        orderBy: [{ rol: "asc" }, { nombre: "asc" }],
        select: { id: true, nombre: true, usuario: true, rol: true },
      },
    },
  });
  if (!centro) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={centro.nombre} subtitle={`Empresa: ${centro.codigo}`} />

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Datos del centro</h2>
        <CentroForm
          centro={{
            id: centro.id,
            codigo: centro.codigo,
            nombre: centro.nombre,
            subtitulo: centro.subtitulo,
            activo: centro.activo,
          }}
        />
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Restablecer clave</h2>
        <p className="mb-4 text-sm text-slate-500">
          Para cuando un usuario del centro olvidó su clave. El resto de usuarios
          los gestiona el administrador del centro en Configuración.
        </p>
        <ClaveForm centroId={centro.id} usuarios={centro.usuarios} />
      </Card>
    </div>
  );
}
