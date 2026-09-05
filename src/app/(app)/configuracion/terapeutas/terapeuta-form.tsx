"use client";

import { useFormReintento } from "@/components/form-reintento";
import { guardarTerapeuta, type FormState } from "../actions";
import { Button, ButtonLink, Field, Input, Select } from "@/components/ui";

type SedeOpcion = { id: string; nombre: string };

type TerapeutaInicial = {
  id: string;
  sedeId: string;
  nombres: string;
  apellidos: string;
  especialidad: string | null;
  telefono: string | null;
  activo: boolean;
};

export function TerapeutaForm({
  sedes,
  terapeuta,
}: {
  sedes: SedeOpcion[];
  terapeuta?: TerapeutaInicial;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
  } = useFormReintento<FormState>(guardarTerapeuta, undefined);

  return (
    <form {...formProps} className="space-y-4">
      {terapeuta && <input type="hidden" name="id" value={terapeuta.id} />}

      <Field label="Sede" required>
        <Select name="sedeId" defaultValue={terapeuta?.sedeId ?? ""} required>
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

      <Field label="Nombres" required>
        <Input name="nombres" defaultValue={terapeuta?.nombres} required />
      </Field>
      <Field label="Apellidos" required>
        <Input name="apellidos" defaultValue={terapeuta?.apellidos} required />
      </Field>
      <Field label="Especialidad">
        <Input
          name="especialidad"
          defaultValue={terapeuta?.especialidad ?? ""}
        />
      </Field>
      <Field label="Teléfono">
        <Input name="telefono" defaultValue={terapeuta?.telefono ?? ""} />
      </Field>
      <Field label="Estado">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={terapeuta?.activo ?? true}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Terapeuta activo
        </label>
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : terapeuta ? "Actualizar" : "Crear terapeuta"}
        </Button>
        {terapeuta && (
          <ButtonLink href="/configuracion/terapeutas" variant="secondary">
            Cancelar
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
