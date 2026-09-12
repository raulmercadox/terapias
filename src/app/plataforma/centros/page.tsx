import { requireSuperadmin } from "@/lib/session";
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

export default async function CentrosPage() {
  await requireSuperadmin();

  const centros = await prisma.centro.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: { _count: { select: { sedes: true, usuarios: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centros"
        subtitle="Empresas que usan el sistema. El código es lo que escriben en «Empresa» al iniciar sesión."
        actions={<ButtonLink href="/plataforma/centros/nuevo">Nuevo centro</ButtonLink>}
      />

      {centros.length === 0 ? (
        <EmptyState message="Todavía no hay centros registrados." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Sedes</Th>
              <Th>Usuarios</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {centros.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono text-sm">{c.codigo}</Td>
                <Td>
                  <span className="font-medium text-slate-900">{c.nombre}</span>
                  {c.subtitulo && (
                    <span className="block text-xs text-slate-400">{c.subtitulo}</span>
                  )}
                </Td>
                <Td>{c._count.sedes}</Td>
                <Td>{c._count.usuarios}</Td>
                <Td>
                  {c.activo ? (
                    <Badge color="green">Activo</Badge>
                  ) : (
                    <Badge color="red">Inactivo</Badge>
                  )}
                </Td>
                <Td className="text-right">
                  <ButtonLink href={`/plataforma/centros/${c.id}`} variant="ghost">
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
