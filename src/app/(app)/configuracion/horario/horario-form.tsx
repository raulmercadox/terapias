"use client";

import { useMemo, useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { guardarHorarioLaboral, type FormState } from "../actions";
import { Button, Field, Input, Select } from "@/components/ui";
import { DIA_NOMBRE, DIAS_ORDEN } from "../../sesiones/horario";

type SedeHorario = {
  id: string;
  horaApertura: string;
  horaCierre: string;
  refrigerioInicio: string | null;
  refrigerioFin: string | null;
  diasLaborales: number[];
  intervaloCalendario: number;
  intervalosCalendario: number[];
};

/** "15, 30, 45" → [15, 30, 45] (solo los valores numéricos válidos). */
function parseIntervalos(s: string): number[] {
  const nums = s
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

export function HorarioForm({
  sede,
  guardado,
}: {
  sede: SedeHorario;
  guardado?: boolean;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(guardarHorarioLaboral, undefined);

  // Lista de intervalos editable; el "inicial" se elige entre sus valores.
  const [listaStr, setListaStr] = useState(
    sede.intervalosCalendario.join(", "),
  );
  const [inicial, setInicial] = useState(String(sede.intervaloCalendario));
  const opciones = useMemo(() => parseIntervalos(listaStr), [listaStr]);
  // Si el inicial elegido ya no está en la lista, cae al primer valor.
  const inicialEfectivo = opciones.includes(Number(inicial))
    ? inicial
    : String(opciones[0] ?? "");

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      <input type="hidden" name="sedeId" value={sede.id} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Hora de apertura" required>
          <Input
            type="time"
            name="horaApertura"
            defaultValue={sede.horaApertura}
            required
          />
        </Field>
        <Field label="Hora de cierre" required>
          <Input
            type="time"
            name="horaCierre"
            defaultValue={sede.horaCierre}
            required
          />
        </Field>
      </div>

      <Field label="Refrigerio (opcional)">
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="time"
            name="refrigerioInicio"
            defaultValue={sede.refrigerioInicio ?? ""}
            aria-label="Inicio del refrigerio"
          />
          <Input
            type="time"
            name="refrigerioFin"
            defaultValue={sede.refrigerioFin ?? ""}
            aria-label="Fin del refrigerio"
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Si lo indicas, al armar un paquete no se podrán agendar sesiones que
          se crucen con esa hora. Deja ambos campos vacíos para no usarlo.
        </p>
      </Field>

      <Field label="Intervalos del calendario (minutos)">
        <Input
          type="text"
          name="intervalosCalendario"
          value={listaStr}
          onChange={(e) => setListaStr(e.target.value)}
          placeholder="15, 30, 45, 60"
          required
          className="max-w-[20rem]"
        />
        <p className="mt-1 text-xs text-slate-400">
          Opciones que ofrecerá el selector “Intervalo” del calendario al
          agendar un paquete. Sepáralas con comas; cada una debe ser un
          múltiplo de 5 entre 5 y 120.
        </p>
      </Field>

      <Field label="Intervalo inicial">
        <Select
          name="intervaloCalendario"
          value={inicialEfectivo}
          onChange={(e) => setInicial(e.target.value)}
          className="max-w-[12rem]"
        >
          {opciones.map((p) => (
            <option key={p} value={p}>
              {p} minutos
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-slate-400">
          El intervalo seleccionado por defecto al abrir el calendario.
        </p>
      </Field>

      <Field label="Días de atención">
        <div className="flex flex-wrap gap-3">
          {DIAS_ORDEN.map((dia) => (
            <label
              key={dia}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name="diasLaborales"
                value={dia}
                defaultChecked={sede.diasLaborales.includes(dia)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              {DIA_NOMBRE[dia]}
            </label>
          ))}
        </div>
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {guardado && !state?.error && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Horario guardado.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar horario"}
      </Button>
    </form>
  );
}
