"use client";

import { useFormReintento } from "@/components/form-reintento";
import { guardarSede, type FormState } from "../actions";
import { Button, ButtonLink, Field, Input } from "@/components/ui";

type SedeInicial = {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
};

export function SedeForm({ sede }: { sede?: SedeInicial }) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(guardarSede, undefined);

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      {sede && <input type="hidden" name="id" value={sede.id} />}

      <Field label="Nombre" required>
        <Input name="nombre" defaultValue={sede?.nombre} required />
      </Field>
      <Field label="Dirección">
        <Input name="direccion" defaultValue={sede?.direccion ?? ""} />
      </Field>
      <Field label="Teléfono">
        <Input name="telefono" defaultValue={sede?.telefono ?? ""} />
      </Field>
      <Field label="Estado">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={sede?.activo ?? true}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Sede activa
        </label>
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : sede ? "Actualizar" : "Crear sede"}
        </Button>
        {sede && (
          <ButtonLink href="/configuracion/sedes" variant="secondary">
            Cancelar
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
