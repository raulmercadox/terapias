"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Field, Input, Select, Textarea, Button } from "@/components/ui";
import { crearPaquete, type ActionState } from "../actions";
import { DIA_NOMBRE, DIAS_ORDEN, generarIntervalos } from "../horario";

const initial: ActionState = { ok: false };

type Opcion = { id: string; nombre: string };
type ProgramaOpt = { id: string; nombre: string; duracionMin: number };

/** Hoy en formato "YYYY-MM-DD" (hora local). */
function hoyISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
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
}: {
  sedeId: string;
  pacientes: Opcion[];
  terapeutas: Opcion[];
  programas: ProgramaOpt[];
  horaApertura: string;
  horaCierre: string;
  diasLaborales: number[];
  feriados: string[];
}) {
  const [state, formAction, pending] = useActionState(crearPaquete, initial);

  const [programaId, setProgramaId] = useState(programas[0]?.id ?? "");
  // Día (getDay) → hora de inicio elegida. La presencia de la clave = día marcado.
  const [diasHora, setDiasHora] = useState<Record<number, string>>({});

  const programa = programas.find((p) => p.id === programaId);
  const duracionMin = programa?.duracionMin ?? 45;

  const intervalos = useMemo(
    () => generarIntervalos(horaApertura, horaCierre, duracionMin),
    [horaApertura, horaCierre, duracionMin],
  );

  // Días disponibles (laborales) en orden lunes→domingo.
  const diasDisponibles = DIAS_ORDEN.filter((d) => diasLaborales.includes(d));

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

  function toggleDia(dia: number, checked: boolean) {
    setDiasHora((prev) => {
      const siguiente = { ...prev };
      if (checked) siguiente[dia] = intervalos[0]?.inicio ?? "";
      else delete siguiente[dia];
      return siguiente;
    });
  }

  function setHora(dia: number, hora: string) {
    setDiasHora((prev) => ({ ...prev, [dia]: hora }));
  }

  const diasSeleccionados = Object.keys(diasHora).map(Number);
  const horarioJSON = JSON.stringify(
    diasSeleccionados
      .sort((a, b) => a - b)
      .map((dia) => ({ dia, hora: diasHora[dia] })),
  );

  const sinIntervalos = intervalos.length === 0;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sedeId" value={sedeId} />
      <input type="hidden" name="horario" value={horarioJSON} />

      <Field label="Paciente" required>
        <Select name="pacienteId" required defaultValue="">
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

      <Field label="Días y hora de la sesión" required>
        {sinIntervalos ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            El horario de atención de la sede no permite sesiones de{" "}
            {duracionMin} min. Ajusta el horario en Configuración › Horario de
            atención.
          </p>
        ) : (
          <div className="space-y-2">
            {diasDisponibles.map((dia) => {
              const marcado = dia in diasHora;
              return (
                <div key={dia} className="flex items-center gap-3">
                  <label className="flex w-32 items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={(e) => toggleDia(dia, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    {DIA_NOMBRE[dia]}
                  </label>
                  {marcado && (
                    <Select
                      value={diasHora[dia]}
                      onChange={(e) => setHora(dia, e.target.value)}
                      className="max-w-[12rem]"
                    >
                      {intervalos.map((i) => (
                        <option key={i.inicio} value={i.inicio}>
                          {i.inicio} – {i.fin}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-slate-400">
              Horario de atención: {horaApertura}–{horaCierre} · sesiones de{" "}
              {duracionMin} min.
            </p>
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Total de sesiones" required>
          <Input
            type="number"
            name="totalSesiones"
            min={1}
            max={60}
            defaultValue={12}
            required
          />
        </Field>
        <Field label="Fecha de inicio" required>
          <Input
            type="date"
            name="fechaInicio"
            defaultValue={hoyISO()}
            required
          />
        </Field>
      </div>

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

      <Field label="Terapeuta (por defecto, opcional)">
        <Select name="terapeutaId" defaultValue="">
          <option value="">Sin asignar</option>
          {terapeutas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </Select>
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
