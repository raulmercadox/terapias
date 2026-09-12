import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  Card,
  Badge,
  ButtonLink,
  EmptyState,
  Table,
  Th,
  Td,
} from "@/components/ui";
import { nombreCompleto, edad, fecha } from "@/lib/utils";
import { normalizarSecciones } from "../informes/informe";
import { ImprimirBoton } from "./imprimir-boton";
import {
  MAX_PUNTOS,
  compararInformes,
  serieProgreso,
  type PuntoProgreso,
} from "./progreso";
import {
  BarraComposicion,
  LeyendaValores,
  MarcaCambio,
  TendenciaArea,
  type PuntoLinea,
} from "./graficos";

/**
 * Las áreas de la serie: las del informe más reciente primero, más las que
 * aparezcan solo en informes viejos (una sección pudo salir de la plantilla).
 * Sin esto, un cambio de catálogo desalinearía las curvas entre informes.
 */
function areasDeLaSerie(serie: PuntoProgreso[]): { id: string; titulo: string }[] {
  const areas: { id: string; titulo: string }[] = [];
  for (const punto of [...serie].reverse()) {
    for (const a of punto.areas) {
      if (!areas.some((x) => x.id === a.id)) areas.push({ id: a.id, titulo: a.titulo });
    }
  }
  return areas;
}

/** Serie de un área concreta, con hueco (logro null) donde no fue evaluada. */
function puntosDelArea(serie: PuntoProgreso[], areaId: string): PuntoLinea[] {
  return serie.map((punto) => {
    const a =
      areaId === "general"
        ? punto.general
        : punto.areas.find((x) => x.id === areaId);
    return {
      fecha: punto.fecha,
      logro: a?.logro ?? null,
      calificados: a?.calificados ?? 0,
      total: a?.total ?? 0,
    };
  });
}

export default async function ProgresoPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const paciente = await prisma.paciente.findUnique({
    where: { id },
    select: {
      id: true,
      sedeId: true,
      nombres: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
      fechaNacimiento: true,
    },
  });
  if (!paciente || !(await canAccessSede(user, paciente.sedeId))) notFound();

  const informes = await prisma.informeAvance.findMany({
    where: { pacienteId: paciente.id },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      fecha: true,
      secciones: true,
      evaluador: { select: { nombres: true, apellidos: true } },
    },
  });

  const encabezado = (
    <PageHeader
      title="Progreso del paciente"
      subtitle={`${nombreCompleto(paciente)} · ${edad(paciente.fechaNacimiento)}`}
      actions={
        <ButtonLink href={`/pacientes/${paciente.id}`} variant="secondary">
          Volver al paciente
        </ButtonLink>
      }
    />
  );

  if (informes.length === 0) {
    return (
      <div className="space-y-6">
        {encabezado}
        <EmptyState message="El progreso se calcula a partir de los informes de avance y este paciente todavía no tiene ninguno." />
        <div className="flex justify-center">
          <ButtonLink href={`/pacientes/${paciente.id}/informes/nuevo`}>
            Registrar el primer informe
          </ButtonLink>
        </div>
      </div>
    );
  }

  const serie = serieProgreso(informes);
  const areas = areasDeLaSerie(serie);
  const ultimo = serie.at(-1)!;
  const previo = serie.at(-2);

  const delta =
    ultimo.general.logro !== null && previo?.general.logro != null
      ? ultimo.general.logro - previo.general.logro
      : null;

  // La comparación ítem a ítem va sobre los dos informes más recientes.
  const cambios =
    informes.length >= 2
      ? compararInformes(
          normalizarSecciones(informes.at(-2)!.secciones),
          normalizarSecciones(informes.at(-1)!.secciones),
        )
      : [];

  const evaluador = (i: (typeof informes)[number]) =>
    i.evaluador ? `${i.evaluador.nombres} ${i.evaluador.apellidos}`.trim() : null;

  return (
    <div className="space-y-6">
      {encabezado}
      <ImprimirBoton />

      {/* print-area: al imprimir se oculta todo lo demás (ver globals.css). */}
      <div className="print-area space-y-6">
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Logro general en el último informe
              </p>
              <p className="mt-1 text-5xl font-semibold text-slate-900">
                {ultimo.general.logro === null ? "—" : `${ultimo.general.logro}%`}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Informe del {fecha(ultimo.fecha)} ·{" "}
                {ultimo.general.calificados} de {ultimo.general.total} ítems
                calificados
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              {delta === null ? (
                <Badge color="slate">
                  {previo ? "Sin comparación posible" : "Primer informe"}
                </Badge>
              ) : (
                <Badge color={delta > 0 ? "green" : delta < 0 ? "red" : "slate"}>
                  {delta > 0 ? "▲" : delta < 0 ? "▼" : "="}{" "}
                  {delta === 0
                    ? "Igual que el informe anterior"
                    : `${Math.abs(delta)} puntos ${delta > 0 ? "más" : "menos"} que el informe anterior`}
                </Badge>
              )}
              <span className="text-xs text-slate-500">
                {informes.length}{" "}
                {informes.length === 1 ? "informe registrado" : "informes registrados"}
                {informes.length > MAX_PUNTOS &&
                  ` · se grafican los ${MAX_PUNTOS} más recientes`}
              </span>
            </div>
          </div>

          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
            El logro resume la escala del informe (EI = 0, EP = 1, LE = 2) como
            porcentaje del máximo posible, contando solo los ítems calificados.
            Es una ayuda para leer la evolución del paciente respecto de sí
            mismo, no una medida comparable entre pacientes ni entre
            profesionales. Las fichas de evaluación no entran en este cálculo:
            usan otra escala.
          </p>
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Tendencia por área
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Un punto por informe, en orden cronológico.
          </p>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <TendenciaArea
              titulo="General"
              puntos={puntosDelArea(serie, "general")}
            />
            {areas.map((a) => (
              <TendenciaArea
                key={a.id}
                titulo={a.titulo}
                puntos={puntosDelArea(serie, a.id)}
              />
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Composición de cada informe
            </h2>
            <LeyendaValores />
          </div>
          <ul className="space-y-3">
            {[...serie].reverse().map((punto) => {
              const informe = informes.find((i) => i.id === punto.informeId)!;
              return (
                <li
                  key={punto.informeId}
                  className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,12rem)_1fr_auto]"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/pacientes/${paciente.id}/informes/${punto.informeId}`}
                      className="text-sm font-medium text-sky-700 hover:underline"
                    >
                      {fecha(punto.fecha)}
                    </Link>
                    {evaluador(informe) && (
                      <p className="truncate text-xs text-slate-500">
                        {evaluador(informe)}
                      </p>
                    )}
                  </div>
                  <BarraComposicion
                    id={punto.informeId}
                    conteo={punto.general.conteo}
                    etiqueta={`Informe del ${fecha(punto.fecha)}`}
                  />
                  <span className="text-xs text-slate-500">
                    {punto.general.calificados}/{punto.general.total} calificados
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {cambios.length > 0 ? (
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Qué cambió respecto al informe anterior
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Informe del {fecha(informes.at(-2)!.fecha)} → informe del{" "}
              {fecha(informes.at(-1)!.fecha)}. Los ítems se emparejan por su
              identificador, no por su texto.
            </p>

            <div className="space-y-6">
              {cambios.map((area) => (
                <div key={area.id}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {area.titulo}
                    </h3>
                    <Badge color={area.mejoras > 0 ? "green" : "slate"}>
                      ▲ {area.mejoras} mejoró
                    </Badge>
                    <Badge color="slate">= {area.iguales} se mantiene</Badge>
                    <Badge color={area.retrocesos > 0 ? "red" : "slate"}>
                      ▼ {area.retrocesos} retrocedió
                    </Badge>
                  </div>
                  {area.items.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin ítems.</p>
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <Th>Ítem</Th>
                          <Th className="w-20">Antes</Th>
                          <Th className="w-20">Ahora</Th>
                          <Th className="w-40">Cambio</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {area.items.map((item) => (
                          <tr key={item.id}>
                            <Td>{item.label}</Td>
                            <Td className="text-slate-500">
                              {item.anterior ?? "—"}
                            </Td>
                            <Td className="font-medium">{item.actual ?? "—"}</Td>
                            <Td>
                              <MarcaCambio estado={item.estado} />
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <Card>
            <p className="text-sm text-slate-600">
              Con un solo informe hay una foto, todavía no una tendencia. Al
              registrar el siguiente informe aparecerá aquí la comparación ítem
              por ítem.
            </p>
          </Card>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Logro por informe (%)
          </h2>
          <Table>
            <thead>
              <tr>
                <Th>Informe</Th>
                <Th className="w-24">General</Th>
                {areas.map((a) => (
                  <Th key={a.id}>{a.titulo}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...serie].reverse().map((punto) => (
                <tr key={punto.informeId}>
                  <Td>{fecha(punto.fecha)}</Td>
                  <Td className="font-medium">
                    {punto.general.logro === null ? "—" : `${punto.general.logro}%`}
                  </Td>
                  {areas.map((a) => {
                    const area = punto.areas.find((x) => x.id === a.id);
                    return (
                      <Td key={a.id}>
                        {area?.logro == null ? "—" : `${area.logro}%`}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      </div>
    </div>
  );
}
