"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Field, Input, Select, Textarea, Button } from "@/components/ui";
import { crearPaquete, type ActionState } from "../actions";
import { DIA_NOMBRE, DIAS_ORDEN, claveFecha, generarIntervalos } from "../horario";

const initial: ActionState = { ok: false };
/** Máximo de semanas hacia adelante que se pueden previsualizar. */
const MAX_SEMANAS = 16;

type Opcion = { id: string; nombre: string };
type ProgramaOpt = {
  id: string;
  nombre: string;
  duracionMin: number;
  maxPacientes: number;
};
/** Cita futura de la sede (precalculada en el server con su día y clave). */
type CitaOcup = {
  terapeutaId: string | null;
  pacienteId: string;
  dia: number; // getDay(): 0=Dom..6=Sáb
  clave: string; // "YYYY-MM-DD"
  horaInicio: string;
  horaFin: string;
};

/** Estado de disponibilidad de una celda del calendario. */
type EstadoCelda =
  | "libre"
  | "parcial"
  | "lleno"
  | "pacienteOcupado"
  | "feriado"
  | "pasado";

/** Solapamiento de rangos "HH:mm" (comparación lexicográfica). */
function solapan(aI: string, aF: string, bI: string, bF: string): boolean {
  return aI < bF && aF > bI;
}

/** Lunes (00:00 local) de la semana que contiene a `d`. */
function lunesDeSemana(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Dom..6=Sáb
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
}

function sumarDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Desplazamiento (días) desde el lunes para un getDay() dado. */
function offsetDesdeLunes(dia: number): number {
  return dia === 0 ? 6 : dia - 1;
}

function fmtCorta(d: Date): string {
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function fmtLarga(d: Date): string {
  return d.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function NuevoPaqueteForm({
  sedeId,
  pacientes,
  terapeutas,
  programas,
  horaApertura,
  horaCierre,
  diasLaborales,
  feriados,
  citas,
}: {
  sedeId: string;
  pacientes: Opcion[];
  terapeutas: Opcion[];
  programas: ProgramaOpt[];
  horaApertura: string;
  horaCierre: string;
  diasLaborales: number[];
  feriados: string[];
  citas: CitaOcup[];
}) {
  const [state, formAction, pending] = useActionState(crearPaquete, initial);

  const [pacienteId, setPacienteId] = useState("");
  const [terapeutaId, setTerapeutaId] = useState("");
  const [programaId, setProgramaId] = useState(programas[0]?.id ?? "");
  // Día (getDay) → hora de inicio elegida. La presencia de la clave = día marcado.
  const [diasHora, setDiasHora] = useState<Record<number, string>>({});
  // Semana mostrada (y de inicio del paquete): 0 = semana actual.
  const [semana, setSemana] = useState(0);

  const programa = programas.find((p) => p.id === programaId);
  const duracionMin = programa?.duracionMin ?? 45;
  const cupo = programa?.maxPacientes ?? 1;

  const intervalos = useMemo(
    () => generarIntervalos(horaApertura, horaCierre, duracionMin),
    [horaApertura, horaCierre, duracionMin],
  );

  // Días disponibles (laborales) en orden lunes→domingo.
  const diasDisponibles = useMemo(
    () => DIAS_ORDEN.filter((d) => diasLaborales.includes(d)),
    [diasLaborales],
  );

  // Referencias de fecha.
  const hoy = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const hoyClave = claveFecha(hoy);
  const lunesBase = useMemo(() => lunesDeSemana(hoy), [hoy]);
  const lunesSemana = useMemo(
    () => sumarDias(lunesBase, semana * 7),
    [lunesBase, semana],
  );
  // El paquete inicia el primer día válido de la semana mostrada (>= hoy).
  const inicioPaquete = lunesSemana < hoy ? hoy : lunesSemana;
  const fechaInicioValue = claveFecha(inicioPaquete);

  // Fecha real de cada día laboral en la semana mostrada.
  const fechaDeDia = useMemo(() => {
    const m = new Map<number, Date>();
    for (const d of diasDisponibles) {
      m.set(d, sumarDias(lunesSemana, offsetDesdeLunes(d)));
    }
    return m;
  }, [diasDisponibles, lunesSemana]);

  // Al cambiar la duración, normaliza las horas elegidas a intervalos válidos.
  useEffect(() => {
    setDiasHora((prev) => {
      const validas = new Set(intervalos.map((i) => i.inicio));
      const siguiente: Record<number, string> = {};
      for (const [dia, hora] of Object.entries(prev)) {
        siguiente[Number(dia)] = validas.has(hora)
          ? hora
          : (intervalos[0]?.inicio ?? "");
      }
      return siguiente;
    });
  }, [intervalos]);

  // Disponibilidad por celda (día + intervalo) en la SEMANA MOSTRADA, según las
  // citas reales del terapeuta y del paciente elegidos.
  const disponibilidad = useMemo(() => {
    const mapa = new Map<string, EstadoCelda>();
    if (!terapeutaId) return mapa;

    const citasTer = citas.filter((c) => c.terapeutaId === terapeutaId);
    const citasPac = pacienteId
      ? citas.filter((c) => c.pacienteId === pacienteId)
      : [];
    const feriadosSet = new Set(feriados);

    for (const dia of diasDisponibles) {
      const clave = claveFecha(fechaDeDia.get(dia)!);
      for (const intv of intervalos) {
        const key = `${dia}|${intv.inicio}`;

        if (clave < hoyClave) {
          mapa.set(key, "pasado");
          continue;
        }
        if (feriadosSet.has(clave)) {
          mapa.set(key, "feriado");
          continue;
        }

        // El paciente ya tiene una sesión que se cruza ese día.
        const pacConflicto = citasPac.some(
          (c) =>
            c.clave === clave &&
            solapan(intv.inicio, intv.fin, c.horaInicio, c.horaFin),
        );
        if (pacConflicto) {
          mapa.set(key, "pacienteOcupado");
          continue;
        }

        // Pacientes distintos del terapeuta en esa fecha/franja (excl. el propio).
        const otros = new Set<string>();
        for (const c of citasTer) {
          if (c.clave !== clave) continue;
          if (!solapan(intv.inicio, intv.fin, c.horaInicio, c.horaFin)) continue;
          if (c.pacienteId === pacienteId) continue;
          otros.add(c.pacienteId);
        }
        mapa.set(
          key,
          otros.size >= cupo ? "lleno" : otros.size > 0 ? "parcial" : "libre",
        );
      }
    }
    return mapa;
  }, [
    citas,
    terapeutaId,
    pacienteId,
    intervalos,
    diasDisponibles,
    cupo,
    fechaDeDia,
    feriados,
    hoyClave,
  ]);

  function toggleCelda(dia: number, hora: string, seleccionable: boolean) {
    setDiasHora((prev) => {
      const siguiente = { ...prev };
      if (siguiente[dia] === hora) {
        delete siguiente[dia]; // clic en la celda ya elegida → la quita
        return siguiente;
      }
      if (!seleccionable) return prev;
      siguiente[dia] = hora; // una sola hora por día
      return siguiente;
    });
  }

  const diasSeleccionados = Object.keys(diasHora).map(Number);
  const horarioJSON = JSON.stringify(
    diasSeleccionados
      .sort((a, b) => a - b)
      .map((dia) => ({ dia, hora: diasHora[dia] })),
  );

  const resumen = DIAS_ORDEN.filter((d) => d in diasHora)
    .map((d) => `${DIA_NOMBRE[d].slice(0, 3)} ${diasHora[d]}`)
    .join(" · ");

  const sinIntervalos = intervalos.length === 0;
  const finSemana = sumarDias(lunesSemana, 5); // sáb

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sedeId" value={sedeId} />
      <input type="hidden" name="horario" value={horarioJSON} />
      <input type="hidden" name="fechaInicio" value={fechaInicioValue} />

      <Field label="Paciente" required>
        <Select
          name="pacienteId"
          required
          value={pacienteId}
          onChange={(e) => setPacienteId(e.target.value)}
        >
          <option value="" disabled>
            Seleccione un paciente…
          </option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Programa" required>
        <Select
          name="programaId"
          required
          value={programaId}
          onChange={(e) => setProgramaId(e.target.value)}
        >
          {programas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · {p.duracionMin} min
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Terapeuta" required>
        <Select
          name="terapeutaId"
          required
          value={terapeutaId}
          onChange={(e) => setTerapeutaId(e.target.value)}
        >
          <option value="" disabled>
            Seleccione un terapeuta…
          </option>
          {terapeutas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </Select>
        {programa && programa.maxPacientes > 1 && (
          <p className="mt-1 text-xs text-slate-400">
            Programa grupal: hasta {programa.maxPacientes} pacientes por terapeuta
            en la misma fecha y hora.
          </p>
        )}
      </Field>

      <Field label="Disponibilidad — elige los días y la hora" required>
        {sinIntervalos ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            El horario de atención de la sede no permite sesiones de{" "}
            {duracionMin} min. Ajusta el horario en Configuración › Horario de
            atención.
          </p>
        ) : !terapeutaId ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Selecciona un terapeuta para ver su calendario de disponibilidad.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Navegación de semana */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSemana((s) => Math.max(0, s - 1))}
                disabled={semana === 0}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                ‹ Semana anterior
              </button>
              <span className="text-sm font-medium text-slate-700">
                {fmtCorta(lunesSemana)} – {fmtCorta(finSemana)}{" "}
                {finSemana.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => setSemana((s) => Math.min(MAX_SEMANAS, s + 1))}
                disabled={semana >= MAX_SEMANAS}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 disabled:opacity-40 hover:bg-slate-50"
              >
                Semana siguiente ›
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-1 text-xs">
                <thead>
                  <tr>
                    <th className="p-1" />
                    {diasDisponibles.map((d) => (
                      <th
                        key={d}
                        className="px-2 py-1 font-medium text-slate-600"
                      >
                        {DIA_NOMBRE[d].slice(0, 3)}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {fechaDeDia.get(d)!.getDate()}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {intervalos.map((intv) => (
                    <tr key={intv.inicio}>
                      <td className="whitespace-nowrap pr-2 text-right text-slate-400">
                        {intv.inicio}
                      </td>
                      {diasDisponibles.map((d) => {
                        const estado =
                          disponibilidad.get(`${d}|${intv.inicio}`) ?? "libre";
                        const elegido = diasHora[d] === intv.inicio;
                        const seleccionable =
                          estado === "libre" || estado === "parcial";
                        return (
                          <td key={d} className="p-0">
                            <button
                              type="button"
                              disabled={!seleccionable && !elegido}
                              onClick={() =>
                                toggleCelda(d, intv.inicio, seleccionable)
                              }
                              title={`${DIA_NOMBRE[d]} ${fechaDeDia
                                .get(d)!
                                .getDate()} · ${intv.inicio}–${intv.fin}`}
                              className={[
                                "w-full rounded px-2 py-1 text-[11px] font-medium transition",
                                elegido
                                  ? "bg-sky-600 text-white"
                                  : estado === "libre"
                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : estado === "parcial"
                                      ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                      : estado === "lleno"
                                        ? "cursor-not-allowed bg-red-50 text-red-300"
                                        : estado === "feriado"
                                          ? "cursor-not-allowed bg-violet-50 text-violet-400"
                                          : estado === "pacienteOcupado"
                                            ? "cursor-not-allowed bg-slate-100 text-slate-300"
                                            : "cursor-not-allowed bg-slate-50 text-slate-300",
                              ].join(" ")}
                            >
                              {elegido
                                ? "Elegido"
                                : estado === "libre"
                                  ? "Libre"
                                  : estado === "parcial"
                                    ? "Disp."
                                    : estado === "lleno"
                                      ? "Lleno"
                                      : estado === "feriado"
                                        ? "Feriado"
                                        : estado === "pacienteOcupado"
                                          ? "Paciente"
                                          : "—"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
              <Leyenda clase="bg-emerald-50 text-emerald-700" texto="Libre" />
              <Leyenda
                clase="bg-amber-50 text-amber-700"
                texto="Con cupo (grupal)"
              />
              <Leyenda clase="bg-red-50 text-red-300" texto="Terapeuta lleno" />
              <Leyenda
                clase="bg-slate-100 text-slate-300"
                texto="Paciente ocupado"
              />
              <Leyenda clase="bg-violet-50 text-violet-400" texto="Feriado" />
              <Leyenda clase="bg-sky-600 text-white" texto="Elegido" />
            </div>

            <p className="text-[11px] text-slate-400">
              Los colores muestran la ocupación de la semana visible. El patrón
              de días/horas elegido se repite cada semana.
            </p>

            {resumen && (
              <p className="text-xs text-slate-600">
                <span className="font-medium">Días elegidos:</span> {resumen}
              </p>
            )}
          </div>
        )}
      </Field>

      <Field label="Total de sesiones" required>
        <Input
          type="number"
          name="totalSesiones"
          min={1}
          max={60}
          defaultValue={12}
          required
          className="max-w-[10rem]"
        />
      </Field>

      {terapeutaId && !sinIntervalos && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          El paquete iniciará el <b>{fmtLarga(inicioPaquete)}</b> y las sesiones
          se repetirán semanalmente en los días elegidos. Usa ‹ › para empezar en
          otra semana.
        </p>
      )}

      <Field label="Precio (S/)" required>
        <Input
          type="number"
          name="precio"
          min={0}
          step="0.01"
          placeholder="0.00"
          required
        />
      </Field>

      <Field label="Observación (opcional)">
        <Textarea name="observacion" placeholder="Notas del paquete…" />
      </Field>

      {feriados.length > 0 && (
        <p className="text-xs text-slate-400">
          Se omitirán automáticamente los {feriados.length} feriado(s)
          configurado(s) en esta sede.
        </p>
      )}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="submit"
          disabled={pending || sinIntervalos || diasSeleccionados.length === 0}
        >
          {pending ? "Creando…" : "Crear paquete"}
        </Button>
      </div>
    </form>
  );
}

function Leyenda({ clase, texto }: { clase: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-4 rounded ${clase}`} />
      {texto}
    </span>
  );
}
