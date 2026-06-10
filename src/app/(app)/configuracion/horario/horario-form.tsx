"use client";

import { useActionState } from "react";
import { guardarHorarioLaboral, type FormState } from "../actions";
import { Button, Field, Input } from "@/components/ui";
import { DIA_NOMBRE, DIAS_ORDEN } from "../../sesiones/horario";

type SedeHorario = {
  id: string;
  horaApertura: string;
  horaCierre: string;
  diasLaborales: number[];
};

export function HorarioForm({
  sede,
  guardado,
}: {
  sede: SedeHorario;
  guardado?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    guardarHorarioLaboral,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
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
