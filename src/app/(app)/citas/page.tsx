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
import { fecha, nombreCompleto } from "@/lib/utils";
import {
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
} from "./helpers";
import { FiltroTerapeuta } from "./filtro-terapeuta";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; terapeutaId?: string }>;
}) {
  const user = await requireUser();
  const sedeId = await requireActiveSede(user);
  const { semana, terapeutaId } = await searchParams;

  const lunes = lunesDeLaSemana(parseFechaISO(semana) ?? new Date());
  const dias = diasDeLaSemana(lunes);
  const rangoInicio = new Date(lunes);
  const rangoFin = sumarDias(lunes, 7); // lunes siguiente (exclusivo) → incluye domingo

  const semanaAnterior = aISO(sumarDias(lunes, -7));
  const semanaSiguiente = aISO(sumarDias(lunes, 7));
  const semanaActual = aISO(lunesDeLaSemana(new Date()));

  const terapeutaFiltro =
    terapeutaId && terapeutaId.length > 0 ? terapeutaId : undefined;

  const [terapeutas, citas] = await Promise.all([
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
  ]);

  // Agrupa por día (clave "YYYY-MM-DD" local).
  const porDia = new Map<string, typeof citas>();
  for (const c of citas) {
    const key = aISO(c.fecha);
    const arr = porDia.get(key) ?? [];
    arr.push(c);
    porDia.set(key, arr);
  }

  const baseParams = (s: string) =>
    `?semana=${s}${terapeutaFiltro ? `&terapeutaId=${terapeutaFiltro}` : ""}`;

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
        </div>

        <Form action="/citas" replace scroll={false} className="flex items-end gap-2">
          <input type="hidden" name="semana" value={aISO(lunes)} />
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dias.map((dia, i) => {
          const key = aISO(dia);
          const items = porDia.get(key) ?? [];
          const esHoy = key === aISO(new Date());
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

      {citas.length === 0 && (
        <EmptyState message="No hay citas en esta semana para la sede activa." />
      )}
    </div>
  );
}
