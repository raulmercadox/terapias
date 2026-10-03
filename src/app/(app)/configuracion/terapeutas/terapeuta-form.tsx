"use client";

import { useFormReintento } from "@/components/form-reintento";
import { guardarTerapeuta, type FormState } from "../actions";
import Link from "next/link";
import { Button, ButtonLink, Field, Input, Select } from "@/components/ui";

type SedeOpcion = { id: string; nombre: string };
type EspecialidadOpcion = { id: string; nombre: string; activo: boolean };

type TerapeutaInicial = {
  id: string;
  sedeId: string;
  nombres: string;
  apellidos: string;
  especialidadIds: string[];
  telefono: string | null;
  activo: boolean;
  refrigerioInicio: string | null;
  refrigerioFin: string | null;
};

export function TerapeutaForm({
  sedes,
  especialidades,
  terapeuta,
}: {
  sedes: SedeOpcion[];
  especialidades: EspecialidadOpcion[];
  terapeuta?: TerapeutaInicial;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(guardarTerapeuta, undefined);

  return (
    <form key={formKey} {...formProps} className="space-y-4">
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
      <Field label="Especialidades" required>
        {especialidades.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay especialidades registradas.{" "}
            <Link
              href="/configuracion/especialidades"
              className="text-sky-600 underline hover:text-sky-700"
            >
              Crear especialidades
            </Link>
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            {especialidades.map((e) => (
              <label
                key={e.id}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  name="especialidadIds"
                  value={e.id}
                  defaultChecked={terapeuta?.especialidadIds.includes(e.id)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                {e.nombre}
                {!e.activo && (
                  <span className="text-xs text-slate-400">(inactiva)</span>
                )}
              </label>
            ))}
          </div>
        )}
      </Field>
      <Field label="Teléfono">
        <Input name="telefono" defaultValue={terapeuta?.telefono ?? ""} />
      </Field>
      <Field label="Refrigerio (opcional)">
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="time"
            name="refrigerioInicio"
            defaultValue={terapeuta?.refrigerioInicio ?? ""}
            aria-label="Inicio del refrigerio"
          />
          <Input
            type="time"
            name="refrigerioFin"
            defaultValue={terapeuta?.refrigerioFin ?? ""}
            aria-label="Fin del refrigerio"
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Si lo indicas, reemplaza al refrigerio de la sede para este
          terapeuta. Deja ambos campos vacíos para usar el de la sede.
        </p>
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
