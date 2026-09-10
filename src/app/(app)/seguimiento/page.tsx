import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, requireActiveSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  ButtonLink,
  EmptyState,
  Badge,
  Card,
  Paginacion,
} from "@/components/ui";
import { nombreCompleto, fecha, fechaHora } from "@/lib/utils";
import { normalizarTelefonoPe } from "../citas/helpers";
import { contarPendientes, idsPendientes } from "./consultas";
import {
  pendienteDe,
  diasDesde,
  tiempoEspera,
  aInputLima,
  parseInputLima,
  CANAL_LABEL,
  RESULTADO_LABEL,
} from "./seguimiento";
import { RegistrarInteraccion } from "./interaccion-form";

const POR_PAGINA = 20;

const VINCULO_LABEL: Record<string, string> = {
  MADRE: "Madre",
  PADRE: "Padre",
  APODERADO: "Apoderado",
  OTRO: "Otro",
};

/** Rojo desde la semana sin contacto; ámbar desde el tercer día. */
function colorAntiguedad(dias: number): "red" | "amber" | "slate" {
  if (dias >= 7) return "red";
  if (dias >= 2) return "amber";
  return "slate";
}

function Telefono({ etiqueta, numero }: { etiqueta: string; numero: string }) {
  const wa = normalizarTelefonoPe(numero);
  return (
    <p className="text-sm text-slate-600">
      <span className="text-slate-400">{etiqueta}:</span>{" "}
      <a href={`tel:${numero}`} className="font-medium text-slate-800 hover:underline">
        {numero}
      </a>
      {wa && (
        <>
          {" · "}
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 hover:underline"
          >
            WhatsApp
          </a>
        </>
      )}
    </p>
  );
}

export default async function SeguimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();
  const sedeId = await requireActiveSede(user);
  const { pagina: paginaParam } = await searchParams;

  const total = await contarPendientes(sedeId);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaPedida = Number.parseInt(paginaParam ?? "1", 10);
  const pagina = Number.isNaN(paginaPedida)
    ? 1
    : Math.min(Math.max(1, paginaPedida), totalPaginas);

  const ids = await idsPendientes(sedeId, (pagina - 1) * POR_PAGINA, POR_PAGINA);

  const ahora = new Date();
  const inicioHoy = parseInputLima(`${aInputLima(ahora).slice(0, 10)}T00:00`)!;

  const [pacientes, salidasHoy] = await Promise.all([
    prisma.paciente.findMany({
      where: { id: { in: ids }, sedeId },
      select: {
        id: true,
        nombres: true,
        apellidoPaterno: true,
        apellidoMaterno: true,
        telefono: true,
        estado: true,
        apoderados: {
          orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
          take: 1,
          select: { nombres: true, apellidos: true, telefono: true, vinculo: true },
        },
        interacciones: {
          orderBy: { fecha: "desc" },
          select: { direccion: true, canal: true, resultado: true, fecha: true, nota: true },
        },
      },
    }),
    prisma.interaccion.findMany({
      where: { sedeId, direccion: "SALIDA", fecha: { gte: inicioHoy } },
      orderBy: { fecha: "desc" },
      include: {
        paciente: {
          select: { id: true, nombres: true, apellidoPaterno: true, apellidoMaterno: true },
        },
      },
    }),
  ]);

  // findMany no respeta el orden de `ids`: se recupera el de la bandeja.
  const porId = new Map(pacientes.map((p) => [p.id, p]));
  const filas = ids.flatMap((id) => {
    const p = porId.get(id);
    const pendiente = p && pendienteDe(p.interacciones);
    return p && pendiente ? [{ paciente: p, pendiente }] : [];
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seguimiento de interesados"
        subtitle="Quienes buscaron al centro y aún no han sido contactados, del más antiguo al más reciente"
        actions={
          <ButtonLink href="/pacientes/nuevo" variant="secondary">
            Registrar nuevo interesado
          </ButtonLink>
        }
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Por contactar{" "}
          <span className="text-sm font-normal text-slate-500">({total})</span>
        </h2>

        {filas.length === 0 ? (
          <EmptyState message="No hay interesados pendientes de contacto. ¡Bandeja al día!" />
        ) : (
          <ul className="space-y-3">
            {filas.map(({ paciente: p, pendiente }) => {
              const dias = diasDesde(pendiente.desde, ahora);
              const ultimaEntrada = p.interacciones.find(
                (i) => i.direccion === "ENTRADA",
              );
              const apo = p.apoderados[0];
              return (
                <li key={p.id}>
                  <Card className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/pacientes/${p.id}`}
                            className="font-medium text-sky-700 hover:underline"
                          >
                            {nombreCompleto(p)}
                          </Link>
                          <Badge color={colorAntiguedad(dias)}>
                            Esperando {tiempoEspera(dias)}
                          </Badge>
                          {p.estado === "BAJA" && <Badge color="red">BAJA</Badge>}
                        </div>
                        <p className="text-xs text-slate-500">
                          Pendiente desde {fechaHora(pendiente.desde)}
                          {pendiente.entradas > 1 &&
                            ` · nos buscó ${pendiente.entradas} veces`}
                          {pendiente.intentos > 0 &&
                            ` · ${pendiente.intentos} intento${
                              pendiente.intentos === 1 ? "" : "s"
                            } sin respuesta (último ${fecha(pendiente.ultimoIntento)})`}
                        </p>
                      </div>
                      <RegistrarInteraccion
                        pacienteId={p.id}
                        soloSalida
                        etiqueta="Registrar contacto"
                      />
                    </div>

                    {ultimaEntrada && (
                      <p className="text-sm text-slate-700">
                        <span className="text-slate-400">
                          {CANAL_LABEL[ultimaEntrada.canal]} ·{" "}
                          {fechaHora(ultimaEntrada.fecha)}
                          {ultimaEntrada.nota ? ": " : ""}
                        </span>
                        {ultimaEntrada.nota && (
                          <span className="whitespace-pre-wrap">{ultimaEntrada.nota}</span>
                        )}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      {p.telefono && <Telefono etiqueta="Paciente" numero={p.telefono} />}
                      {apo?.telefono && (
                        <Telefono
                          etiqueta={`${VINCULO_LABEL[apo.vinculo] ?? "Apoderado"} (${[
                            apo.nombres,
                            apo.apellidos,
                          ]
                            .filter(Boolean)
                            .join(" ")})`}
                          numero={apo.telefono}
                        />
                      )}
                      {!p.telefono && !apo?.telefono && (
                        <p className="text-sm text-amber-700">
                          Sin teléfono registrado
                        </p>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={total}
          hrefBase="/seguimiento"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          Contactos de hoy{" "}
          <span className="text-sm font-normal text-slate-500">
            ({salidasHoy.length})
          </span>
        </h2>
        {salidasHoy.length === 0 ? (
          <EmptyState message="Aún no se ha registrado ningún contacto hoy." />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {salidasHoy.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                  <span className="w-20 shrink-0 text-xs text-slate-500">
                    {fechaHora(s.fecha).split(", ")[1]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/pacientes/${s.paciente.id}`}
                        className="text-sm font-medium text-sky-700 hover:underline"
                      >
                        {nombreCompleto(s.paciente)}
                      </Link>
                      <Badge color={s.resultado === "SIN_RESPUESTA" ? "amber" : "green"}>
                        {s.resultado ? RESULTADO_LABEL[s.resultado] : "Contactado"}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {CANAL_LABEL[s.canal]}
                        {s.autor ? ` · ${s.autor}` : ""}
                      </span>
                    </div>
                    {s.nota && (
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                        {s.nota}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
