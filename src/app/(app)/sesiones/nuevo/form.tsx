"use client";

import { useActionState, useMemo, useState } from "react";
import { Field, Input, Select, Textarea, Button } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { crearPaquete, type ActionState } from "../actions";
import {
  DIA_NOMBRE,
  DIAS_ORDEN,
  PASOS_GRILLA,
  claveFecha,
  generarIntervalos,
} from "../horario";

const initial: ActionState = { ok: false };
/** Máximo de semanas hacia adelante que se pueden navegar (~1 año). */
const MAX_SEMANAS = 60;

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

/** "YYYY-MM-DD" → "lun 06/07" (para los chips de sesiones marcadas). */
function fmtClave(clave: string): string {
  const [y, m, d] = clave.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
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
  intervaloCalendario,
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
  intervaloCalendario: number;
  feriados: string[];
  citas: CitaOcup[];
}) {
  const [state, formAction, pending] = useActionState(crearPaquete, initial);

  const [pacienteId, setPacienteId] = useState("");
  const [terapeutaId, setTerapeutaId] = useState("");
  const [programaId, setProgramaId] = useState(programas[0]?.id ?? "");
  // Total de sesiones a marcar (controlado: define cuántas faltan).
  const [totalStr, setTotalStr] = useState("12");
  // Sesiones marcadas: clave de fecha "YYYY-MM-DD" → hora de inicio.
  // (Cada entrada es una sesión concreta; NO se repite por semana.)
  const [sesionesSel, setSesionesSel] = useState<Record<string, string>>({});
  // Semana mostrada: 0 = semana actual.
  const [semana, setSemana] = useState(0);
  // Paso de la grilla (min entre horas de inicio ofrecidas). Es solo un modo
  // de vista: cambiarlo no borra las sesiones ya marcadas.
  const [paso, setPaso] = useState(
    PASOS_GRILLA.includes(intervaloCalendario as (typeof PASOS_GRILLA)[number])
      ? intervaloCalendario
      : 30,
  );

  const programa = programas.find((p) => p.id === programaId);
  const duracionMin = programa?.duracionMin ?? 45;
  const cupo = programa?.maxPacientes ?? 1;

  const total = Math.max(0, Math.floor(Number(totalStr) || 0));
  const marcadas = Object.keys(sesionesSel).length;
  const faltan = Math.max(0, total - marcadas);
  const completo = total > 0 && marcadas === total;

  const intervalos = useMemo(
    () => generarIntervalos(horaApertura, horaCierre, duracionMin, paso),
    [horaApertura, horaCierre, duracionMin, paso],
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

  // Fecha real de cada día laboral en la semana mostrada.
  const fechaDeDia = useMemo(() => {
    const m = new Map<number, Date>();
    for (const d of diasDisponibles) {
      m.set(d, sumarDias(lunesSemana, offsetDesdeLunes(d)));
    }
    return m;
  }, [diasDisponibles, lunesSemana]);

  // Cambiar de programa (duración) o terapeuta invalida las horas/colores: se
  // limpian las sesiones marcadas para evitar selecciones inconsistentes.
  function cambiarPrograma(id: string) {
    setProgramaId(id);
    setSesionesSel({});
  }
  function cambiarTerapeuta(id: string) {
    setTerapeutaId(id);
    setSesionesSel({});
  }

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
        const key = `${clave}|${intv.inicio}`;

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

  function toggleCelda(clave: string, hora: string, seleccionable: boolean) {
    setSesionesSel((prev) => {
      const next = { ...prev };
      // Clic en la celda ya elegida ese día → la quita.
      if (next[clave] === hora) {
        delete next[clave];
        return next;
      }
      if (!seleccionable) return prev;
      const yaTieneEseDia = clave in next;
      // No permitir superar el total (salvo que sea mover la hora del mismo día).
      if (!yaTieneEseDia && total > 0 && Object.keys(next).length >= total) {
        return prev;
      }
      next[clave] = hora; // una sola hora por día concreto
      return next;
    });
  }

  // Sesiones marcadas en orden cronológico (clave "YYYY-MM-DD" ordena bien).
  const seleccionadas = useMemo(
    () =>
      Object.entries(sesionesSel)
        .map(([clave, hora]) => ({ clave, hora }))
        .sort((a, b) =>
          a.clave === b.clave
            ? a.hora.localeCompare(b.hora)
            : a.clave.localeCompare(b.clave),
        ),
    [sesionesSel],
  );

  const sesionesJSON = JSON.stringify(
    seleccionadas.map((s) => ({ fecha: s.clave, hora: s.hora })),
  );

  const sinIntervalos = intervalos.length === 0;
  const finSemana = sumarDias(lunesSemana, 5); // sáb

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sedeId" value={sedeId} />
      <input type="hidden" name="sesiones" value={sesionesJSON} />

      <Field label="Paciente" required>
        <Combobox
          name="pacienteId"
          required
          options={pacientes}
          value={pacienteId}
          onChange={setPacienteId}
          placeholder="Seleccione un paciente…"
        />
      </Field>

      <Field label="Programa" required>
        <Select
          name="programaId"
          required
          value={programaId}
          onChange={(e) => cambiarPrograma(e.target.value)}
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
          onChange={(e) => cambiarTerapeuta(e.target.value)}
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

      <Field label="Total de sesiones" required>
        <Input
          type="number"
          name="totalSesiones"
          min={1}
          max={60}
          value={totalStr}
          onChange={(e) => setTotalStr(e.target.value)}
          required
          className="max-w-[10rem]"
        />
        <p className="mt-1 text-xs text-slate-400">
          Marca esta cantidad de sesiones en el calendario, una por una.
        </p>
      </Field>

      <Field label="Calendario — marca cada sesión en su fecha" required>
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
            {/* Progreso de marcado */}
            <div
              className={[
                "rounded-lg px-3 py-2 text-sm",
                completo
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-sky-50 text-sky-800",
              ].join(" ")}
            >
              {completo ? (
                <>
                  Listo: marcaste las <b>{total}</b> sesiones.
                </>
              ) : marcadas === 0 ? (
                <>
                  Marca <b>{total}</b> sesión(es) navegando por las semanas.
                </>
              ) : (
                <>
                  Marcadas <b>{marcadas}</b> de <b>{total}</b> · faltan{" "}
                  <b>{faltan}</b>.
                </>
              )}
            </div>

            {/* Paso de la grilla (modo de vista) */}
            <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
              <span>Intervalo:</span>
              <select
                value={paso}
                onChange={(e) => setPaso(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none"
              >
                {PASOS_GRILLA.map((p) => (
                  <option key={p} value={p}>
                    {p} min
                  </option>
                ))}
              </select>
            </div>

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
                        const clave = claveFecha(fechaDeDia.get(d)!);
                        const estado =
                          disponibilidad.get(`${clave}|${intv.inicio}`) ??
                          "libre";
                        const elegido = sesionesSel[clave] === intv.inicio;
                        const seleccionable =
                          estado === "libre" || estado === "parcial";
                        // Si ya se alcanzó el total, no se pueden añadir nuevas.
                        const bloqueadoPorTope =
                          !elegido &&
                          !(clave in sesionesSel) &&
                          total > 0 &&
                          marcadas >= total;
                        const deshabilitado =
                          (!seleccionable && !elegido) || bloqueadoPorTope;
                        return (
                          <td key={d} className="p-0">
                            <button
                              type="button"
                              disabled={deshabilitado}
                              onClick={() =>
                                toggleCelda(clave, intv.inicio, seleccionable)
                              }
                              title={`${DIA_NOMBRE[d]} ${fechaDeDia
                                .get(d)!
                                .getDate()} · ${intv.inicio}–${intv.fin}`}
                              className={[
                                "w-full rounded px-2 py-1 text-[11px] font-medium transition",
                                elegido
                                  ? "bg-sky-600 text-white"
                                  : bloqueadoPorTope && seleccionable
                                    ? "cursor-not-allowed bg-slate-50 text-slate-300"
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

            {seleccionadas.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">
                  Sesiones marcadas ({seleccionadas.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {seleccionadas.map((s) => (
                    <button
                      key={s.clave}
                      type="button"
                      onClick={() =>
                        setSesionesSel((prev) => {
                          const n = { ...prev };
                          delete n[s.clave];
                          return n;
                        })
                      }
                      title="Quitar esta sesión"
                      className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-800 hover:bg-sky-200"
                    >
                      {fmtClave(s.clave)} · {s.hora}
                      <span className="text-sky-500">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Field>

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
          Los días feriados de la sede aparecen marcados y no se pueden
          seleccionar.
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
          disabled={pending || sinIntervalos || !terapeutaId || !completo}
        >
          {pending
            ? "Creando…"
            : completo
              ? "Crear paquete"
              : `Faltan ${faltan} sesión(es)`}
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
