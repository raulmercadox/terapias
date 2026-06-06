import Link from "next/link";
import { requireUser, requireActiveSede } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  ButtonLink,
  EmptyState,
  Table,
  Th,
  Td,
  Badge,
} from "@/components/ui";
import { soles, fecha, nombreCompleto } from "@/lib/utils";
import { estadoPaqueteColor, estadoPaqueteLabel } from "./ui";

export default async function SesionesPage() {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);

  const paquetes = await prisma.paquete.findMany({
    where: { sedeId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      totalSesiones: true,
      frecuenciaSemana: true,
      precio: true,
      fechaInicio: true,
      fechaFin: true,
      estado: true,
      paciente: {
        select: {
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
        },
      },
      // Sesiones "usadas" = citas SESION con asistencia != PENDIENTE.
      _count: {
        select: {
          citas: { where: { tipo: "SESION", asistencia: { not: "PENDIENTE" } } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paquetes de sesiones"
        subtitle="Terapias vendidas por paquetes para la sede activa."
        actions={<ButtonLink href="/sesiones/nuevo">Nuevo paquete</ButtonLink>}
      />

      {paquetes.length === 0 ? (
        <EmptyState message="No hay paquetes registrados en esta sede. Cree el primero con “Nuevo paquete”." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Paciente</Th>
              <Th>Sesiones</Th>
              <Th>Restantes</Th>
              <Th>Precio</Th>
              <Th>Inicio</Th>
              <Th>Fin</Th>
              <Th>Estado</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paquetes.map((p) => {
              const usadas = p._count.citas;
              const restantes = Math.max(0, p.totalSesiones - usadas);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">
                    {nombreCompleto(p.paciente)}
                  </Td>
                  <Td>
                    {usadas} / {p.totalSesiones}
                    <span className="ml-1 text-xs text-slate-400">
                      ({p.frecuenciaSemana}×sem)
                    </span>
                  </Td>
                  <Td>{restantes}</Td>
                  <Td>{soles(p.precio)}</Td>
                  <Td>{fecha(p.fechaInicio)}</Td>
                  <Td>{fecha(p.fechaFin)}</Td>
                  <Td>
                    <Badge color={estadoPaqueteColor[p.estado]}>
                      {estadoPaqueteLabel[p.estado]}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/sesiones/${p.id}`}
                      className="text-sm font-medium text-sky-600 hover:text-sky-700"
                    >
                      Ver
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
