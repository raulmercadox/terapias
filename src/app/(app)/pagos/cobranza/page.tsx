import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireActiveSede,
  getCentro,
  puedeVerPagos,
} from "@/lib/session";
import { PageHeader, ButtonLink, EmptyState, Table, Th, Td, Badge } from "@/components/ui";
import { soles } from "@/lib/utils";
import { WhatsAppButton } from "../../citas/whatsapp-button";
import {
  COBRO_COLOR,
  describirRegla,
  fechaDeISO,
  mensajeWhatsAppCobro,
  textoCobro,
} from "../cobranza";
import { cobranzaDeSede, type FilaCobranza } from "../consultas-cobranza";

export default async function CobranzaPage() {
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();
  const sedeId = await requireActiveSede(user);

  const [{ regla, hoy, vencidos, porVencer }, sede, centro] = await Promise.all([
    cobranzaDeSede(sedeId, user.centroId),
    prisma.sede.findUnique({ where: { id: sedeId }, select: { nombre: true } }),
    getCentro(user.centroId),
  ]);

  const aviso =
    regla.diasAviso === 1 ? "1 día antes" : `${regla.diasAviso} días antes`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobranza"
        subtitle={`Plazo de pago: ${describirRegla(regla)} · aviso ${aviso}.`}
        actions={
          <>
            {user.rol === "ADMINISTRADOR" && (
              <ButtonLink href="/configuracion/cobranza" variant="ghost">
                Configurar plazo
              </ButtonLink>
            )}
            <ButtonLink href="/pagos" variant="secondary">
              Volver a pagos
            </ButtonLink>
          </>
        }
      />

      <Seccion
        titulo={`Vencidos (${vencidos.length})`}
        vacio="No hay pagos vencidos."
        filas={vencidos}
        hoy={hoy}
        centro={centro.nombre}
        sede={sede?.nombre ?? ""}
      />
      <Seccion
        titulo={`Por vencer en los próximos ${regla.diasAviso} días (${porVencer.length})`}
        vacio="No hay pagos por vencer en estos días."
        filas={porVencer}
        hoy={hoy}
        centro={centro.nombre}
        sede={sede?.nombre ?? ""}
      />
    </div>
  );
}

function Seccion({
  titulo,
  vacio,
  filas,
  hoy,
  centro,
  sede,
}: {
  titulo: string;
  vacio: string;
  filas: FilaCobranza[];
  hoy: string;
  centro: string;
  sede: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      {filas.length === 0 ? (
        <EmptyState message={vacio} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Paciente</Th>
              <Th>Teléfono</Th>
              <Th className="text-right">Precio</Th>
              <Th className="text-right">Pagado</Th>
              <Th className="text-right">Saldo</Th>
              <Th>Plazo</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((f) => (
              <tr key={f.paqueteId} className="hover:bg-slate-50">
                <Td>
                  <Link
                    href={`/sesiones/${f.paqueteId}`}
                    className="font-medium text-sky-700 hover:underline"
                  >
                    {f.paciente}
                  </Link>
                  <span className="block text-xs text-slate-400">
                    {f.totalSesiones} sesiones · {fechaDeISO(f.inicioISO)} –{" "}
                    {fechaDeISO(f.finISO)}
                  </span>
                </Td>
                <Td>{f.telefono ?? "—"}</Td>
                <Td className="text-right">{soles(f.precio)}</Td>
                <Td className="text-right">{soles(f.pagado)}</Td>
                <Td className="text-right font-semibold text-slate-900">
                  {soles(f.saldo)}
                </Td>
                <Td>
                  <Badge color={COBRO_COLOR[f.estado]}>
                    {textoCobro(f.estado, f.limiteISO, hoy)}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-2">
                    <WhatsAppButton
                      telefono={f.whatsapp}
                      marcarEnviado={false}
                      mensaje={mensajeWhatsAppCobro({
                        centro,
                        sede,
                        paciente: f.pacienteCorto,
                        saldo: f.saldo,
                        limiteISO: f.limiteISO,
                        estado: f.estado,
                      })}
                    >
                      WhatsApp
                    </WhatsAppButton>
                    <ButtonLink
                      href={`/pagos/nuevo?pacienteId=${f.pacienteId}&paqueteId=${f.paqueteId}`}
                      variant="ghost"
                    >
                      Registrar pago
                    </ButtonLink>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}
