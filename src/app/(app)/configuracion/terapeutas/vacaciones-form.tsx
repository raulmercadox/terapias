"use client";

import { useFormReintento } from "@/components/form-reintento";
import {
  crearVacacion,
  eliminarVacacion,
  type FormState,
} from "../actions";
import { Button, Field, Input } from "@/components/ui";

export function VacacionForm({ terapeutaId }: { terapeutaId: string }) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(crearVacacion, undefined);

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      <input type="hidden" name="terapeutaId" value={terapeutaId} />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Desde" required>
          <Input type="date" name="fechaInicio" required />
        </Field>
        <Field label="Hasta" required>
          <Input type="date" name="fechaFin" required />
        </Field>
      </div>
      <Field label="Descripción">
        <Input name="descripcion" placeholder="Vacaciones, licencia, etc." />
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Agregando…" : "Agregar vacaciones"}
      </Button>
    </form>
  );
}

export function EliminarVacacionBtn({ id }: { id: string }) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(eliminarVacacion, undefined);

  return (
    <form key={formKey} {...formProps} className="inline">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "…" : "Eliminar"}
      </Button>
      {state?.error && (
        <span className="ml-2 text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
