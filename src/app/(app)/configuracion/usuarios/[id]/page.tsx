import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { UsuarioForm } from "../usuario-form";
import { terapeutasVinculables } from "../terapeutas-vinculables";

export default async function EditarUsuarioPage({
  params,
}: PageProps<"/configuracion/usuarios/[id]">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const { id } = await params;

  const [usuario, sedes, terapeutas] = await Promise.all([
    prisma.user.findFirst({
      where: { id, centroId: user.centroId },
      include: { sedes: { select: { sedeId: true } } },
    }),
    prisma.sede.findMany({
      where: { centroId: user.centroId, activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    terapeutasVinculables(user.centroId, id),
  ]);

  if (!usuario) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar usuario"
        subtitle={usuario.nombre}
      />
      <Card>
        <UsuarioForm
          sedes={sedes}
          terapeutas={terapeutas}
          usuario={{
            id: usuario.id,
            nombre: usuario.nombre,
            usuario: usuario.usuario,
            email: usuario.email,
            rol: usuario.rol,
            activo: usuario.activo,
            sedeIds: usuario.sedes.map((s) => s.sedeId),
            terapeutaId: usuario.terapeutaId,
            permisos: usuario.permisos,
          }}
          esPropio={usuario.id === user.id}
        />
      </Card>
    </div>
  );
}
