"use client";

import { useFormReintento } from "@/components/form-reintento";
import {
  crearFeriado,
  eliminarFeriado,
  type FormState,
} from "../actions";
import { Button, Field, Input } from "@/components/ui";

export function FeriadoForm({ sedeId }: { sedeId: string }) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
  } = useFormReintento<FormState>(crearFeriado, undefined);

  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="sedeId" value={sedeId} />

      <Field label="Fecha" required>
        <Input type="date" name="fecha" required />
      </Field>
      <Field label="Descripción">
        <Input name="descripcion" placeholder="Feriado nacional, etc." />
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Agregando…" : "Agregar feriado"}
      </Button>
    </form>
  );
}

export function EliminarFeriadoBtn({ id }: { id: string }) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
  } = useFormReintento<FormState>(eliminarFeriado, undefined);

  return (
    <form {...formProps} className="inline">
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
