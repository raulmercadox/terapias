import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { UsuarioForm } from "../usuario-form";

export default async function EditarUsuarioPage({
  params,
}: PageProps<"/configuracion/usuarios/[id]">) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const { id } = await params;

  const [usuario, sedes] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { sedes: { select: { sedeId: true } } },
    }),
    prisma.sede.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
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
          usuario={{
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            activo: usuario.activo,
            sedeIds: usuario.sedes.map((s) => s.sedeId),
          }}
          esPropio={usuario.id === user.id}
        />
      </Card>
    </div>
  );
}
