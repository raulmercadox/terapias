"use client";

import { Fragment, useMemo, useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { Field, Input, Select, Textarea, Button } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { cn } from "@/lib/utils";
import { crearPaquete, type ActionState } from "../actions";
import {
  DIA_NOMBRE,
  DIAS_ORDEN,
  opcionesPaso,
  claveFecha,
  generarIntervalos,
  refrigerioEfectivo,
  sumarMinutos,
  esIntervaloValido,
  PASO_GRILLA_MIN,
  type RangoVacaciones,
} from "../horario";
import { proyectarHorario, type DiaPlantilla } from "../renovacion";
import {
  estadoCelda,
  type CitaOcupada,
  type EstadoCelda,
  type ModalidadTerapia,
} from "../disponibilidad";

const initial: ActionState = { ok: false };
/** Máximo de semanas hacia adelante que se pueden navegar (~1 año). */
const MAX_SEMANAS = 60;

type Opcion = { id: string; nombre: string };
/** Terapeuta con su refrigerio propio, especialidades y vacaciones futuras. */
type TerapeutaOpt = Opcion & {
  refrigerioInicio: string | null;
  refrigerioFin: string | null;
  especialidadIds: string[];
  vacaciones: RangoVacaciones[];
};
type TerapiaOpt = Opcion & {
  activo: boolean;
  modalidad: ModalidadTerapia;
  maxParticipantes: number;
  /** Duración de cada sesión de la terapia (min). */
  duracionMin: number;
  especialidadId: string | null;
  especialidad: string | null;
};
type EvaluacionOpt = {
  id: string;
  pacienteId: string;
  etiqueta: string;
  plazoSemanas: number;
  tratamiento: { terapiaId: string; sesiones: number; sesionesSemana: number }[];
};
/** Datos que la renovación hereda del paquete anterior. */
type RenovacionOpt = {
  paqueteId: string;
  /** null si el rol no ve montos: el precio se ingresa a mano. */
  precio: number | null;
  observacion: string;
  sugerencias: { terapiaId: string; terapeutaId: string | null; plantilla: DiaPlantilla[] }[];
};
/** Lo que se pudo precargar de una terapia al renovar. */
type AvisoRenovacion =
  | { tipo: "nueva" }
  | { tipo: "sinTerapeuta" }
  | { tipo: "precargada"; precargadas: number };
/** Cita futura de la sede (precalculada en el server con su clave). */
type CitaOcup = CitaOcupada & { terapeutaId: string | null };

/** Una terapia del tratamiento, tal como se va agendando. */
type Linea = {
  terapiaId: string;
  terapeutaId: string;
  total: string;
  sesionesSemana: number;
  /** Sesiones marcadas: clave "YYYY-MM-DD" → hora de inicio (una por día). */
  sel: Record<string, string>;
};

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

function totalDe(l: Linea): number {
  return Math.max(0, Math.floor(Number(l.total) || 0));
}

/** "YYYY-MM-DD" → getDay() en horario local. */
function diaDeClave(clave: string): number {
  const [y, m, d] = clave.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function lineasDeEvaluacion(ev: EvaluacionOpt | undefined): Linea[] {
  return (ev?.tratamiento ?? []).map((t) => ({
    terapiaId: t.terapiaId,
    terapeutaId: "",
    total: String(t.sesiones),
    sesionesSemana: t.sesionesSemana,
    sel: {},
  }));
}

const ESTILO_CELDA: Record<EstadoCelda, string> = {
  libre: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  parcial: "bg-amber-50 text-amber-700 hover:bg-amber-100",
  lleno: "cursor-not-allowed bg-red-50 text-red-300",
  ocupado: "cursor-not-allowed bg-red-50 text-red-300",
  feriado: "cursor-not-allowed bg-violet-50 text-violet-400",
  vacaciones: "cursor-not-allowed bg-teal-50 text-teal-500",
  pacienteOcupado: "cursor-not-allowed bg-slate-100 text-slate-300",
  pasado: "cursor-not-allowed bg-slate-50 text-slate-300",
};

const TEXTO_CELDA: Record<EstadoCelda, string> = {
  libre: "Libre",
  parcial: "Grupo",
  lleno: "Lleno",
  ocupado: "Ocupado",
  feriado: "Feriado",
  vacaciones: "Vacac.",
  pacienteOcupado: "Paciente",
  pasado: "—",
};

export default function NuevoPaqueteForm({
  sedeId,
  pacientes,
  evaluaciones,
  pacienteInicial,
  evaluacionInicialId,
  renovacion,
  terapias,
  terapeutas,
  horaApertura,
  horaCierre,
  refrigerioInicio,
  refrigerioFin,
  diasLaborales,
  intervaloCalendario,
  intervalosCalendario,
  feriados,
  citas,
}: {
  sedeId: string;
  pacientes: Opcion[];
  evaluaciones: EvaluacionOpt[];
  /** Paciente preseleccionado (desde su ficha o desde una evaluación). */
  pacienteInicial?: string;
  /** Evaluación elegida; por defecto, la más reciente del paciente. */
  evaluacionInicialId?: string;
  /** Modo renovación: paciente y evaluación fijos, terapeuta y horario sugeridos. */
  renovacion?: RenovacionOpt;
  terapias: TerapiaOpt[];
  terapeutas: TerapeutaOpt[];
  horaApertura: string;
  horaCierre: string;
  refrigerioInicio: string | null;
  refrigerioFin: string | null;
  diasLaborales: number[];
  intervaloCalendario: number;
  intervalosCalendario: number[];
  feriados: string[];
  citas: CitaOcup[];
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<ActionState>(crearPaquete, initial);

  // Evaluación de partida: la indicada o, si no, la más reciente del paciente
  // (`evaluaciones` viene ordenada de la más nueva a la más antigua).
  const evaluacionDePartida =
    evaluaciones.find((e) => e.id === evaluacionInicialId) ??
    evaluaciones.find((e) => e.pacienteId === pacienteInicial);
  const [pacienteId, setPacienteId] = useState(pacienteInicial ?? "");
  const [evaluacionId, setEvaluacionId] = useState(evaluacionDePartida?.id ?? "");
  // Al renovar, cada terapia de la evaluación arranca con el terapeuta anterior
  // (si aún puede atenderla) y su horario semanal proyectado desde hoy en las
  // franjas que sigan libres. Lo que no cabe queda para marcarlo a mano.
  const [inicio] = useState(() => {
    const base = lineasDeEvaluacion(evaluacionDePartida);
    const avisos: Record<string, AvisoRenovacion> = {};
    if (!renovacion) return { lineas: base, avisos };

    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const hoyClaveIni = claveFecha(desde);
    const feriadosSet = new Set(feriados);
    const ocupadasPaciente: CitaOcupada[] = citas.filter(
      (c) => c.pacienteId === pacienteInicial,
    );
    const lineasIni = base.map((l) => {
      const sug = renovacion.sugerencias.find((x) => x.terapiaId === l.terapiaId);
      const t = terapias.find((x) => x.id === l.terapiaId);
      if (!t) return l;
      // Terapia que la evaluación agrega: no hay terapeuta ni horario previos.
      if (!sug) {
        avisos[l.terapiaId] = { tipo: "nueva" };
        return l;
      }
      const ter = terapeutas.find(
        (x) =>
          x.id === sug.terapeutaId &&
          (!t.especialidadId || x.especialidadIds.includes(t.especialidadId)),
      );
      if (!ter) {
        avisos[l.terapiaId] = { tipo: "sinTerapeuta" };
        return l;
      }
      const refri = refrigerioEfectivo({ refrigerioInicio, refrigerioFin }, ter);
      const citasTer = citas.filter((c) => c.terapeutaId === ter.id);
      const sel = t.activo
        ? proyectarHorario({
            plantilla: sug.plantilla,
            total: totalDe(l),
            desde,
            semanas: MAX_SEMANAS,
            seleccionable: (clave, hora) => {
              if (!diasLaborales.includes(diaDeClave(clave))) return false;
              if (
                !esIntervaloValido(
                  horaApertura,
                  horaCierre,
                  t.duracionMin,
                  hora,
                  PASO_GRILLA_MIN,
                  refri,
                )
              ) {
                return false;
              }
              const estado = estadoCelda({
                clave,
                horaInicio: hora,
                horaFin: sumarMinutos(hora, t.duracionMin),
                hoyClave: hoyClaveIni,
                feriados: feriadosSet,
                vacaciones: ter.vacaciones,
                citasTerapeuta: citasTer,
                citasPaciente: ocupadasPaciente,
                terapia: t,
                pacienteId: pacienteInicial,
              });
              return estado === "libre" || estado === "parcial";
            },
          })
        : {};
      // Lo marcado ocupa al paciente para las terapias siguientes.
      for (const [clave, hora] of Object.entries(sel)) {
        ocupadasPaciente.push({
          clave,
          pacienteId: pacienteInicial ?? "",
          terapiaId: l.terapiaId,
          horaInicio: hora,
          horaFin: sumarMinutos(hora, t.duracionMin),
        });
      }
      avisos[l.terapiaId] = { tipo: "precargada", precargadas: Object.keys(sel).length };
      return { ...l, terapeutaId: ter.id, sel };
    });
    return { lineas: lineasIni, avisos };
  });
  const avisosRenovacion = inicio.avisos;
  const [lineas, setLineas] = useState<Linea[]>(inicio.lineas);
  // Terapia del tratamiento que se está agendando en el calendario.
  const [activa, setActiva] = useState(0);
  // Semana mostrada: 0 = semana actual.
  const [semana, setSemana] = useState(0);
  // Paso de la grilla (min entre horas de inicio ofrecidas). Es solo un modo
  // de vista: cambiarlo no borra las sesiones ya marcadas.
  const [paso, setPaso] = useState(
    intervaloCalendario > 0 ? intervaloCalendario : 30,
  );
  const pasosVista = useMemo(
    () => opcionesPaso(intervalosCalendario, intervaloCalendario),
    [intervalosCalendario, intervaloCalendario],
  );

  const terapiaPorId = useMemo(() => new Map(terapias.map((t) => [t.id, t])), [terapias]);
  const terapeutaPorId = useMemo(
    () => new Map(terapeutas.map((t) => [t.id, t])),
    [terapeutas],
  );
  const evaluacionesPaciente = evaluaciones.filter((e) => e.pacienteId === pacienteId);

  function elegirPaciente(id: string) {
    setPacienteId(id);
    // Por defecto, la evaluación más reciente del paciente.
    const ev = evaluaciones.find((e) => e.pacienteId === id);
    setEvaluacionId(ev?.id ?? "");
    setLineas(lineasDeEvaluacion(ev));
    setActiva(0);
  }
  function elegirEvaluacion(id: string) {
    setEvaluacionId(id);
    setLineas(lineasDeEvaluacion(evaluaciones.find((e) => e.id === id)));
    setActiva(0);
  }
  function cambiarLinea(i: number, cambio: Partial<Linea>) {
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  }

  const linea = lineas[activa] as Linea | undefined;
  const terapia = linea ? terapiaPorId.get(linea.terapiaId) : undefined;
  const terapeuta = linea ? terapeutaPorId.get(linea.terapeutaId) : undefined;
  // La duración de la sesión la define la terapia.
  const duracionMin = terapia?.duracionMin ?? 45;
  const total = linea ? totalDe(linea) : 0;
  const marcadas = linea ? Object.keys(linea.sel).length : 0;
  const aviso = linea ? avisosRenovacion[linea.terapiaId] : undefined;

  /** Terapeutas que pueden atender una terapia (por su especialidad). */
  function terapeutasPara(t: TerapiaOpt | undefined): TerapeutaOpt[] {
    if (!t?.especialidadId) return terapeutas;
    return terapeutas.filter((x) => x.especialidadIds.includes(t.especialidadId!));
  }

  // El refrigerio propio del terapeuta elegido reemplaza al de la sede.
  const refrigerio = useMemo(
    () => refrigerioEfectivo({ refrigerioInicio, refrigerioFin }, terapeuta),
    [refrigerioInicio, refrigerioFin, terapeuta],
  );

  // El refrigerio parte la grilla: cada tramo arranca su propia rejilla, así
  // que la primera hora tras el descanso es justo cuando este termina.
  const intervalos = useMemo(
    () => generarIntervalos(horaApertura, horaCierre, duracionMin, paso, refrigerio),
    [horaApertura, horaCierre, duracionMin, paso, refrigerio],
  );

  // Días disponibles (laborales) en orden lunes→domingo.
  const diasDisponibles = useMemo(
    () => DIAS_ORDEN.filter((d) => diasLaborales.includes(d)),
    [diasLaborales],
  );

  const hoy = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const hoyClave = claveFecha(hoy);
  const lunesSemana = useMemo(
    () => sumarDias(lunesDeSemana(hoy), semana * 7),
    [hoy, semana],
  );
  const fechaDeDia = useMemo(() => {
    const m = new Map<number, Date>();
    for (const d of diasDisponibles) {
      m.set(d, sumarDias(lunesSemana, offsetDesdeLunes(d)));
    }
    return m;
  }, [diasDisponibles, lunesSemana]);

  // Lo que ya ocupa al paciente: sus citas y lo marcado en las OTRAS terapias
  // de este mismo paquete (con la duración de cada terapia).
  const citasPaciente = useMemo(() => {
    const out: CitaOcupada[] = pacienteId
      ? citas.filter((c) => c.pacienteId === pacienteId)
      : [];
    lineas.forEach((l, i) => {
      if (i === activa) return;
      const dur = terapiaPorId.get(l.terapiaId)?.duracionMin ?? 45;
      for (const [clave, hora] of Object.entries(l.sel)) {
        out.push({
          clave,
          pacienteId,
          terapiaId: l.terapiaId,
          horaInicio: hora,
          horaFin: sumarMinutos(hora, dur),
        });
      }
    });
    return out;
  }, [citas, pacienteId, lineas, activa, terapiaPorId]);

  // Disponibilidad por celda (día + intervalo) en la SEMANA MOSTRADA.
  const disponibilidad = useMemo(() => {
    const mapa = new Map<string, EstadoCelda>();
    if (!terapeuta || !terapia) return mapa;
    const citasTer = citas.filter((c) => c.terapeutaId === terapeuta.id);
    const feriadosSet = new Set(feriados);
    for (const dia of diasDisponibles) {
      const clave = claveFecha(fechaDeDia.get(dia)!);
      for (const intv of intervalos) {
        mapa.set(
          `${clave}|${intv.inicio}`,
          estadoCelda({
            clave,
            horaInicio: intv.inicio,
            horaFin: intv.fin,
            hoyClave,
            feriados: feriadosSet,
            vacaciones: terapeuta.vacaciones,
            citasTerapeuta: citasTer,
            citasPaciente,
            terapia,
            pacienteId: pacienteId || undefined,
          }),
        );
      }
    }
    return mapa;
  }, [
    citas,
    terapeuta,
    terapia,
    pacienteId,
    citasPaciente,
    intervalos,
    diasDisponibles,
    fechaDeDia,
    feriados,
    hoyClave,
  ]);

  function toggleCelda(clave: string, hora: string, seleccionable: boolean) {
    if (!linea) return;
    const next = { ...linea.sel };
    if (next[clave] === hora) {
      // Clic en la celda ya elegida ese día → la quita.
      delete next[clave];
    } else {
      if (!seleccionable) return;
      // No superar el total (salvo que sea mover la hora del mismo día).
      if (!(clave in next) && total > 0 && Object.keys(next).length >= total) return;
      next[clave] = hora; // una sola hora por día concreto
    }
    cambiarLinea(activa, { sel: next });
  }

  // Sesiones marcadas en la semana mostrada, para compararlas con lo sugerido.
  const marcadasSemana = useMemo(() => {
    const lunes = claveFecha(lunesSemana);
    const domingo = claveFecha(sumarDias(lunesSemana, 6));
    return Object.keys(linea?.sel ?? {}).filter((c) => c >= lunes && c <= domingo)
      .length;
  }, [linea, lunesSemana]);

  const lineasCompletas = lineas.map(
    (l) => !!l.terapeutaId && totalDe(l) > 0 && Object.keys(l.sel).length === totalDe(l),
  );
  const todoCompleto = lineas.length > 0 && lineasCompletas.every(Boolean);
  const terapiaInactiva = lineas.some((l) => !terapiaPorId.get(l.terapiaId)?.activo);

  const lineasJSON = JSON.stringify(
    lineas.map((l) => ({
      terapiaId: l.terapiaId,
      terapeutaId: l.terapeutaId,
      sesiones: Object.entries(l.sel)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, hora]) => ({ fecha, hora })),
    })),
  );

  const sinIntervalos = intervalos.length === 0;
  const finSemana = sumarDias(lunesSemana, 5); // sáb
  const seleccionadas = Object.entries(linea?.sel ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      <input type="hidden" name="sedeId" value={sedeId} />
      <input type="hidden" name="lineas" value={lineasJSON} />

      {renovacion ? (
        <>
          <input type="hidden" name="renovarDe" value={renovacion.paqueteId} />
          <input type="hidden" name="pacienteId" value={pacienteId} />
          <input type="hidden" name="evaluacionId" value={evaluacionId} />
          <dl className="grid gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Paciente</dt>
              <dd className="font-medium text-slate-800">
                {pacientes.find((p) => p.id === pacienteId)?.nombre ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Evaluación (tratamiento)</dt>
              <dd className="font-medium text-slate-800">
                {evaluacionDePartida?.etiqueta ?? "—"}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <>
          <Field label="Paciente" required>
            <Combobox
              name="pacienteId"
              required
              options={pacientes}
              value={pacienteId}
              onChange={elegirPaciente}
              placeholder="Seleccione un paciente…"
            />
          </Field>

          {pacienteId && (
            <Field label="Evaluación (tratamiento)" required>
              {evaluacionesPaciente.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  El paciente no tiene una evaluación abierta con tratamiento
                  sugerido. Registra su evaluación (con las terapias y sesiones)
                  antes de programar el paquete.
                </p>
              ) : (
                <Select
                  name="evaluacionId"
                  required
                  value={evaluacionId}
                  onChange={(e) => elegirEvaluacion(e.target.value)}
                >
                  {evaluacionesPaciente.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.etiqueta}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </>
      )}

      {lineas.length > 0 && (
        <div className="space-y-3">
          {/* Una pestaña por terapia del tratamiento */}
          <div className="flex flex-wrap gap-2" role="tablist">
            {lineas.map((l, i) => {
              const t = terapiaPorId.get(l.terapiaId);
              const n = Object.keys(l.sel).length;
              return (
                <button
                  key={l.terapiaId}
                  type="button"
                  role="tab"
                  aria-selected={i === activa}
                  onClick={() => setActiva(i)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition",
                    i === activa
                      ? "border-sky-600 bg-sky-50 text-sky-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <span className="block font-medium">{t?.nombre ?? "Terapia"}</span>
                  <span
                    className={cn(
                      "text-xs",
                      lineasCompletas[i] ? "text-emerald-700" : "text-slate-500",
                    )}
                  >
                    {lineasCompletas[i] ? "✓ " : ""}
                    {n} / {totalDe(l)} sesiones
                  </span>
                </button>
              );
            })}
          </div>

          {linea && terapia && (
            <div className="space-y-4 rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                {terapia.especialidad ?? "Sin especialidad"} · {terapia.duracionMin} min ·{" "}
                {terapia.modalidad === "GRUPAL"
                  ? `Grupal: hasta ${terapia.maxParticipantes} pacientes por franja`
                  : "Individual"}{" "}
                · Sugerido: {linea.sesionesSemana} por semana
              </p>
              {aviso && (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                  {aviso.tipo === "nueva"
                    ? "Terapia nueva en la evaluación: elige el terapeuta y marca las sesiones."
                    : aviso.tipo === "sinTerapeuta"
                      ? "El terapeuta anterior ya no puede atender esta terapia: elige otro terapeuta y marca las sesiones."
                      : aviso.precargadas >= total
                        ? `Se precargó el horario del paquete anterior: ${aviso.precargadas} sesiones. Puedes ajustarlas.`
                        : `Se precargó el horario del paquete anterior: ${aviso.precargadas} de ${total} sesiones (el resto de franjas ya no está libre). Marca las que faltan en el calendario.`}
                </p>
              )}
              {!terapia.activo && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  Esta terapia está inactiva. Actívala en Configuración › Terapias
                  o elige otra evaluación.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                <Field label="Terapeuta" required>
                  <Select
                    value={linea.terapeutaId}
                    onChange={(e) =>
                      // Cambia la disponibilidad: se limpian las marcas.
                      cambiarLinea(activa, { terapeutaId: e.target.value, sel: {} })
                    }
                  >
                    <option value="" disabled>
                      Seleccione un terapeuta…
                    </option>
                    {terapeutasPara(terapia).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </Select>
                  {terapeutasPara(terapia).length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      Ningún terapeuta activo tiene la especialidad{" "}
                      {terapia.especialidad}.
                    </p>
                  )}
                </Field>
                <Field label="Sesiones" required>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={linea.total}
                    onChange={(e) => cambiarLinea(activa, { total: e.target.value })}
                  />
                </Field>
              </div>

              {sinIntervalos ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  El horario de atención de la sede no permite sesiones de{" "}
                  {duracionMin} min. Ajusta el horario en Configuración › Horario
                  de atención.
                </p>
              ) : !terapeuta ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Selecciona un terapeuta para ver su calendario de disponibilidad.
                </p>
              ) : (
                <div className="space-y-3">
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      marcadas === total && total > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-sky-50 text-sky-800",
                    )}
                  >
                    Marcadas <b>{marcadas}</b> de <b>{total}</b>
                    {marcadas < total && (
                      <>
                        {" "}
                        · faltan <b>{total - marcadas}</b>
                      </>
                    )}
                    . Esta semana: <b>{marcadasSemana}</b> (sugerido{" "}
                    {linea.sesionesSemana}).
                  </div>

                  <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                    <span>Intervalo:</span>
                    <select
                      value={paso}
                      onChange={(e) => setPaso(Number(e.target.value))}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:outline-none"
                    >
                      {pasosVista.map((p) => (
                        <option key={p} value={p}>
                          {p} min
                        </option>
                      ))}
                    </select>
                  </div>

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
                            <th key={d} className="px-2 py-1 font-medium text-slate-600">
                              {DIA_NOMBRE[d].slice(0, 3)}
                              <span className="block text-[10px] font-normal text-slate-400">
                                {fechaDeDia.get(d)!.getDate()}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {intervalos.map((intv, i) => (
                          <Fragment key={intv.inicio}>
                            {/* Corte visible entre los dos tramos del día. */}
                            {refrigerio &&
                              intv.inicio >= refrigerio.fin &&
                              (i === 0 || intervalos[i - 1].inicio < refrigerio.fin) && (
                                <tr>
                                  <td
                                    colSpan={diasDisponibles.length + 1}
                                    className="py-1 text-center text-[11px] text-orange-500"
                                  >
                                    Refrigerio · {refrigerio.inicio}–{refrigerio.fin}
                                  </td>
                                </tr>
                              )}
                            <tr>
                              <td className="whitespace-nowrap pr-2 text-right text-slate-400">
                                {intv.inicio}
                              </td>
                              {diasDisponibles.map((d) => {
                                const clave = claveFecha(fechaDeDia.get(d)!);
                                const estado =
                                  disponibilidad.get(`${clave}|${intv.inicio}`) ?? "libre";
                                const elegido = linea.sel[clave] === intv.inicio;
                                const seleccionable =
                                  estado === "libre" || estado === "parcial";
                                // Si ya se alcanzó el total, no se pueden añadir nuevas.
                                const bloqueadoPorTope =
                                  !elegido &&
                                  !(clave in linea.sel) &&
                                  total > 0 &&
                                  marcadas >= total;
                                return (
                                  <td key={d} className="p-0">
                                    <button
                                      type="button"
                                      disabled={(!seleccionable && !elegido) || bloqueadoPorTope}
                                      onClick={() =>
                                        toggleCelda(clave, intv.inicio, seleccionable)
                                      }
                                      title={`${DIA_NOMBRE[d]} ${fechaDeDia
                                        .get(d)!
                                        .getDate()} · ${intv.inicio}–${intv.fin}`}
                                      className={cn(
                                        "w-full rounded px-2 py-1 text-[11px] font-medium transition",
                                        elegido
                                          ? "bg-sky-600 text-white"
                                          : bloqueadoPorTope && seleccionable
                                            ? "cursor-not-allowed bg-slate-50 text-slate-300"
                                            : ESTILO_CELDA[estado],
                                      )}
                                    >
                                      {elegido ? "Elegido" : TEXTO_CELDA[estado]}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                    <Leyenda clase="bg-emerald-50 text-emerald-700" texto="Libre" />
                    <Leyenda clase="bg-amber-50 text-amber-700" texto="Grupo con cupo" />
                    <Leyenda
                      clase="bg-red-50 text-red-300"
                      texto="Terapeuta ocupado / grupo lleno"
                    />
                    <Leyenda
                      clase="bg-slate-100 text-slate-300"
                      texto="Paciente ocupado (otra sesión o terapia)"
                    />
                    <Leyenda clase="bg-violet-50 text-violet-400" texto="Feriado" />
                    <Leyenda
                      clase="bg-teal-50 text-teal-500"
                      texto="Terapeuta de vacaciones"
                    />
                    <Leyenda clase="bg-sky-600 text-white" texto="Elegido" />
                  </div>

                  {seleccionadas.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-600">
                        Sesiones marcadas ({seleccionadas.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {seleccionadas.map(([clave, hora]) => (
                          <button
                            key={clave}
                            type="button"
                            onClick={() => toggleCelda(clave, hora, true)}
                            title="Quitar esta sesión"
                            className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-800 hover:bg-sky-200"
                          >
                            {fmtClave(clave)} · {hora}
                            <span className="text-sky-500">×</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {refrigerio && (
                    <p className="text-xs text-slate-400">
                      Refrigerio de {refrigerio.inicio} a {refrigerio.fin}: el
                      calendario no ofrece horas que se crucen con él.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Field label="Precio del paquete (S/)" required>
        <Input
          type="number"
          name="precio"
          min={0}
          step="0.01"
          placeholder="0.00"
          defaultValue={renovacion?.precio ?? undefined}
          required
        />
      </Field>

      <Field label="Observación (opcional)">
        <Textarea
          name="observacion"
          placeholder="Notas del paquete…"
          defaultValue={renovacion?.observacion}
        />
      </Field>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending || !todoCompleto || terapiaInactiva}>
          {pending
            ? "Creando…"
            : todoCompleto
              ? renovacion
                ? "Crear renovación"
                : "Crear paquete"
              : "Agenda todas las terapias"}
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
