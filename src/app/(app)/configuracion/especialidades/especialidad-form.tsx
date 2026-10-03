"use client";

import { useFormReintento } from "@/components/form-reintento";
import { guardarEspecialidad, type FormState } from "../actions";
import { Button, ButtonLink, Field, Input } from "@/components/ui";

type EspecialidadInicial = {
  id: string;
  nombre: string;
  activo: boolean;
};

export function EspecialidadForm({
  especialidad,
}: {
  especialidad?: EspecialidadInicial;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(guardarEspecialidad, undefined);

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      {especialidad && (
        <input type="hidden" name="id" value={especialidad.id} />
      )}

      <Field label="Nombre" required>
        <Input
          name="nombre"
          defaultValue={especialidad?.nombre}
          placeholder="Terapia de lenguaje"
          required
        />
      </Field>

      <Field label="Estado">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={especialidad?.activo ?? true}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Especialidad activa
        </label>
        <p className="mt-1 text-xs text-slate-400">
          Una especialidad inactiva ya no se puede asignar, pero los terapeutas
          que la tienen la conservan.
        </p>
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Guardando…"
            : especialidad
              ? "Actualizar"
              : "Crear especialidad"}
        </Button>
        {especialidad && (
          <ButtonLink href="/configuracion/especialidades" variant="secondary">
            Cancelar
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
