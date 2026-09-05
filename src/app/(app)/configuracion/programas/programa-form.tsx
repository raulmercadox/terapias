"use client";

import { useFormReintento } from "@/components/form-reintento";
import { guardarPrograma, type FormState } from "../actions";
import { Button, ButtonLink, Field, Input, Select } from "@/components/ui";

type SedeOpcion = { id: string; nombre: string };

type ProgramaInicial = {
  id: string;
  sedeId: string;
  nombre: string;
  duracionMin: number;
  maxPacientes: number;
  activo: boolean;
};

export function ProgramaForm({
  sedes,
  programa,
}: {
  sedes: SedeOpcion[];
  programa?: ProgramaInicial;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
  } = useFormReintento<FormState>(guardarPrograma, undefined);

  return (
    <form {...formProps} className="space-y-4">
      {programa && <input type="hidden" name="id" value={programa.id} />}

      <Field label="Sede" required>
        <Select name="sedeId" defaultValue={programa?.sedeId ?? ""} required>
          <option value="" disabled>
            Selecciona una sede
          </option>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nombre" required>
        <Input
          name="nombre"
          defaultValue={programa?.nombre}
          placeholder="Terapia Individual"
          required
        />
      </Field>

      <Field label="Duración de la sesión (minutos)" required>
        <Input
          type="number"
          name="duracionMin"
          min={5}
          max={480}
          step={5}
          defaultValue={programa?.duracionMin ?? 45}
          required
        />
      </Field>

      <Field label="Cupo máximo de pacientes por franja" required>
        <Input
          type="number"
          name="maxPacientes"
          min={1}
          max={50}
          step={1}
          defaultValue={programa?.maxPacientes ?? 1}
          required
        />
        <p className="mt-1 text-xs text-slate-400">
          1 = terapia individual. Más de 1 = terapia grupal (el terapeuta puede
          atender ese número de pacientes en la misma fecha y hora).
        </p>
      </Field>

      <Field label="Estado">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={programa?.activo ?? true}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Programa activo
        </label>
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : programa ? "Actualizar" : "Crear programa"}
        </Button>
        {programa && (
          <ButtonLink href="/configuracion/programas" variant="secondary">
            Cancelar
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
