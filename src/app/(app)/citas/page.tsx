import Link from "next/link";
import Form from "next/form";
import { requireUser, requireActiveSede } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  PageHeader,
  ButtonLink,
  Card,
  EmptyState,
  Badge,
  Field,
} from "@/components/ui";
import { cn, fecha, nombreCompleto } from "@/lib/utils";
import { refrigerioDe } from "../sesiones/horario";
import {
  consolidarDia,
  lunesDeLaSemana,
  parseFechaISO,
  aISO,
  sumarDias,
  diasDeLaSemana,
  DIAS_SEMANA,
  ESTADO_COLOR,
  ASISTENCIA_COLOR,
  ASISTENCIA_LABEL,
  TIPO_LABEL,
  FILTROS_ESTADO,
  FILTRO_ESTADO_LABEL,
  parseFiltroEstado,
  pasaFiltroEstado,
  type FiltroEstado,
} from "./helpers";
import { FiltroTerapeuta } from "./filtro-terapeuta";
import { VistaConsolidada, type ColumnaDia } from "./vista-consolidada";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    semana?: string;
    terapeutaId?: string;
    vista?: string;
    estado?: string;
  }>;
}) {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  const { semana, terapeutaId, vista, estado } = await searchParams;
  const filtroEstado = parseFiltroEstado(estado);

  const lunes = lunesDeLaSemana(parseFechaISO(semana) ?? new Date());
  const dias = diasDeLaSemana(lunes);
  const rangoInicio = new Date(lunes);
  const rangoFin = sumarDias(lunes, 7); // lunes siguiente (exclusivo) → incluye domingo

  const semanaAnterior = aISO(sumarDias(lunes, -7));
  const semanaSiguiente = aISO(sumarDias(lunes, 7));
  const semanaActual = aISO(lunesDeLaSemana(new Date()));

  const terapeutaFiltro =
    terapeutaId && terapeutaId.length > 0 ? terapeutaId : undefined;
  // La consolidada solo tiene sentido para un terapeuta: con todos juntos no se
  // distingue quién está libre. La preferencia se conserva en la URL.
  const pideConsolidada = vista === "consolidada";
  const consolidada = pideConsolidada && !!terapeutaFiltro;

  const [terapeutas, citas, sede, feriados] = await Promise.all([
    prisma.terapeuta.findMany({
      where: { sedeId, activo: true },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: { id: true, nombres: true, apellidos: true },
    }),
    prisma.cita.findMany({
      where: {
        sedeId,
        fecha: { gte: rangoInicio, lt: rangoFin },
        ...(terapeutaFiltro ? { terapeutaId: terapeutaFiltro } : {}),
      },
      orderBy: [{ fecha: "asc" }, { horaInicio: "asc" }],
      include: {
        paciente: {
          select: {
            nombres: true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          },
        },
        terapeuta: { select: { nombres: true, apellidos: true } },
      },
    }),
    consolidada
      ? prisma.sede.findUnique({
          where: { id: sedeId },
          select: {
            horaApertura: true,
            horaCierre: true,
            refrigerioInicio: true,
            refrigerioFin: true,
            diasLaborales: true,
          },
        })
      : null,
    consolidada
      ? prisma.feriado.findMany({
          where: { sedeId, fecha: { gte: rangoInicio, lt: rangoFin } },
          select: { fecha: true },
        })
      : [],
  ]);

  // Agrupa por día (clave "YYYY-MM-DD" local).
  const porDia = new Map<string, typeof citas>();
  for (const c of citas) {
    const key = aISO(c.fecha);
    const arr = porDia.get(key) ?? [];
    arr.push(c);
    porDia.set(key, arr);
  }

  // La detallada muestra solo las que pasan el filtro de estado.
  const visibles = citas.filter((c) => pasaFiltroEstado(c.estado, filtroEstado));
  const visiblesPorDia = new Map<string, typeof citas>();
  for (const c of visibles) {
    const key = aISO(c.fecha);
    visiblesPorDia.set(key, [...(visiblesPorDia.get(key) ?? []), c]);
  }
  const canceladasOcultas =
    filtroEstado === "activas"
      ? citas.filter((c) => c.estado === "CANCELADA").length
      : 0;

  const hoyISO = aISO(new Date());
  const esFeriado = new Set(feriados.map((f) => aISO(f.fecha)));
  const refrigerio = sede
    ? refrigerioDe(sede.refrigerioInicio, sede.refrigerioFin)
    : null;
  const columnas: ColumnaDia[] = dias.map((dia) => {
    const key = aISO(dia);
    const nota = esFeriado.has(key)
      ? "Feriado"
      : sede && !sede.diasLaborales.includes(dia.getDay())
        ? "No laborable"
        : undefined;
    // Una cita cancelada libera su horario.
    const activas = (porDia.get(key) ?? []).filter((c) => c.estado !== "CANCELADA");
    return {
      key,
      fecha: fecha(dia),
      esHoy: key === hoyISO,
      nota,
      bloques: consolidarDia(
        activas,
        sede && !nota
          ? { apertura: sede.horaApertura, cierre: sede.horaCierre, refrigerio }
          : null,
      ),
    };
  });

  const baseParams = (
    s: string,
    v = pideConsolidada,
    e: FiltroEstado = filtroEstado,
  ) =>
    `?semana=${s}${terapeutaFiltro ? `&terapeutaId=${terapeutaFiltro}` : ""}${
      v ? "&vista=consolidada" : ""
    }${e !== "activas" ? `&estado=${e}` : ""}`;

  const tabBase = "px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        subtitle={`Semana del ${fecha(lunes)} al ${fecha(dias[6])}`}
        actions={<ButtonLink href="/citas/nueva">Nueva cita</ButtonLink>}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <ButtonLink href={`/citas${baseParams(semanaAnterior)}`} variant="secondary">
            ← Anterior
          </ButtonLink>
          <ButtonLink href={`/citas${baseParams(semanaActual)}`} variant="ghost">
            Hoy
          </ButtonLink>
          <ButtonLink href={`/citas${baseParams(semanaSiguiente)}`} variant="secondary">
            Siguiente →
          </ButtonLink>

          <div
            className="ml-2 inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white"
            role="group"
            aria-label="Vista"
          >
            <Link
              href={`/citas${baseParams(aISO(lunes), false)}`}
              className={cn(
                tabBase,
                !consolidada ? "bg-slate-800 text-white" : "text-slate-700 hover:bg-slate-50",
              )}
            >
              Detallada
            </Link>
            {terapeutaFiltro ? (
              <Link
                href={`/citas${baseParams(aISO(lunes), true)}`}
                className={cn(
                  tabBase,
                  "border-l border-slate-300",
                  consolidada ? "bg-slate-800 text-white" : "text-slate-700 hover:bg-slate-50",
                )}
              >
                Consolidada
              </Link>
            ) : (
              <span
                title="Elige un terapeuta para ver sus horarios libres y ocupados"
                className={cn(tabBase, "cursor-not-allowed border-l border-slate-300 text-slate-400")}
              >
                Consolidada
              </span>
            )}
          </div>
        </div>

        <Form action="/citas" replace scroll={false} className="flex items-end gap-2">
          <input type="hidden" name="semana" value={aISO(lunes)} />
          {pideConsolidada && <input type="hidden" name="vista" value="consolidada" />}
          {filtroEstado !== "activas" && (
            <input type="hidden" name="estado" value={filtroEstado} />
          )}
          <Field label="Terapeuta" className="w-60">
            {/* key: al "Limpiar" o cambiar la URL, el select se remonta con el valor nuevo */}
            <FiltroTerapeuta
              key={terapeutaFiltro ?? ""}
              defaultValue={terapeutaFiltro ?? ""}
            >
              <option value="">Todos los terapeutas</option>
              {terapeutas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.apellidos} {t.nombres}
                </option>
              ))}
            </FiltroTerapeuta>
          </Field>
          <ButtonLink
            href={`/citas?semana=${aISO(lunes)}`}
            variant="ghost"
          >
            Limpiar
          </ButtonLink>
          <button type="submit" className="sr-only">
            Filtrar
          </button>
        </Form>
      </div>

      {!consolidada && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Estado</span>
          <div
            className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white"
            role="group"
            aria-label="Estado"
          >
            {FILTROS_ESTADO.map((f, i) => (
              <Link
                key={f}
                href={`/citas${baseParams(aISO(lunes), pideConsolidada, f)}`}
                className={cn(
                  tabBase,
                  i > 0 && "border-l border-slate-300",
                  f === filtroEstado
                    ? "bg-slate-800 text-white"
                    : "text-slate-700 hover:bg-slate-50",
                )}
              >
                {FILTRO_ESTADO_LABEL[f]}
              </Link>
            ))}
          </div>
        </div>
      )}

      {consolidada ? (
        <VistaConsolidada columnas={columnas} />
      ) : (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dias.map((dia, i) => {
          const key = aISO(dia);
          const items = visiblesPorDia.get(key) ?? [];
          const esHoy = key === hoyISO;
          return (
            <Card key={key} className={esHoy ? "ring-2 ring-sky-400" : undefined}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-semibold text-slate-900">
                  {DIAS_SEMANA[i]}
                </h2>
                <span className="text-sm text-slate-500">{fecha(dia)}</span>
              </div>

              {items.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">
                  Sin citas
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/citas/${c.id}`}
                        className="block rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-900">
                            {c.horaInicio}–{c.horaFin}
                          </span>
                          <Badge color={ESTADO_COLOR[c.estado]}>
                            {c.estado}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">
                          {nombreCompleto(c.paciente)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>{TIPO_LABEL[c.tipo]}</span>
                          {c.terapeuta && (
                            <span>
                              · {c.terapeuta.apellidos} {c.terapeuta.nombres}
                            </span>
                          )}
                          <Badge color={ASISTENCIA_COLOR[c.asistencia]}>
                            {ASISTENCIA_LABEL[c.asistencia]}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
      )}

      {!consolidada && canceladasOcultas > 0 && (
        <p className="text-sm text-slate-500">
          {canceladasOcultas === 1
            ? "1 cita cancelada oculta"
            : `${canceladasOcultas} citas canceladas ocultas`}{" "}
          ·{" "}
          <Link
            href={`/citas${baseParams(aISO(lunes), pideConsolidada, "todas")}`}
            className="font-medium text-sky-700 hover:underline"
          >
            Ver todas
          </Link>
        </p>
      )}

      {!consolidada &&
        (citas.length === 0 ? (
          <EmptyState message="No hay citas en esta semana para la sede activa." />
        ) : (
          visibles.length === 0 && (
            <EmptyState message="No hay citas con este estado en esta semana." />
          )
        ))}
    </div>
  );
}
