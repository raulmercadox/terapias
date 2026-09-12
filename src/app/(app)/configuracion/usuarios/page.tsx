import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Badge,
  ButtonLink,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";

const rolLabel: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  COORDINADOR: "Coordinador",
  USUARIO: "Usuario",
};

export default async function UsuariosPage() {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const usuarios = await prisma.user.findMany({
    where: { centroId: user.centroId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: { sedes: { include: { sede: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas de acceso al sistema."
        actions={
          <ButtonLink href="/configuracion/usuarios/nuevo">
            Nuevo usuario
          </ButtonLink>
        }
      />

      {usuarios.length === 0 ? (
        <EmptyState message="No hay usuarios registrados." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Nombre</Th>
              <Th>Usuario</Th>
              <Th>Rol</Th>
              <Th>Sedes</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <Td>
                  <span className="font-medium text-slate-900">{u.nombre}</span>
                  {u.email && (
                    <span className="block text-xs text-slate-400">{u.email}</span>
                  )}
                </Td>
                <Td className="font-mono text-sm">{u.usuario}</Td>
                <Td>{rolLabel[u.rol] ?? u.rol}</Td>
                <Td>
                  {u.rol === "ADMINISTRADOR"
                    ? "Todas"
                    : u.sedes.length === 0
                      ? "—"
                      : u.sedes.map((s) => s.sede.nombre).join(", ")}
                </Td>
                <Td>
                  {u.activo ? (
                    <Badge color="green">Activo</Badge>
                  ) : (
                    <Badge color="red">Inactivo</Badge>
                  )}
                </Td>
                <Td className="text-right">
                  <ButtonLink
                    href={`/configuracion/usuarios/${u.id}`}
                    variant="ghost"
                  >
                    Editar
                  </ButtonLink>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
