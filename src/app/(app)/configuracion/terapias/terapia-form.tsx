"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { guardarTerapia, type FormState } from "../actions";
import { Button, ButtonLink, Field, Input, Select } from "@/components/ui";

type Opcion = { id: string; nombre: string };

type TerapiaInicial = {
  id: string;
  sedeId: string;
  nombre: string;
  especialidadId: string | null;
  modalidad: "INDIVIDUAL" | "GRUPAL";
  duracionMin: number;
  maxParticipantes: number;
  activo: boolean;
};

export function TerapiaForm({
  sedes,
  especialidades,
  terapia,
}: {
  sedes: Opcion[];
  especialidades: Opcion[];
  terapia?: TerapiaInicial;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(guardarTerapia, undefined);
  const [modalidad, setModalidad] = useState(terapia?.modalidad ?? "INDIVIDUAL");

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      {terapia && <input type="hidden" name="id" value={terapia.id} />}

      <Field label="Sede" required>
        <Select name="sedeId" defaultValue={terapia?.sedeId ?? ""} required>
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
          defaultValue={terapia?.nombre}
          placeholder="Terapia de lenguaje"
          required
        />
      </Field>

      <Field label="Especialidad" required>
        <Select
          name="especialidadId"
          defaultValue={terapia?.especialidadId ?? ""}
          required
        >
          <option value="" disabled>
            Selecciona una especialidad
          </option>
          {especialidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-slate-400">
          Al agendar, solo se ofrecen los terapeutas con esta especialidad.
        </p>
      </Field>

      <Field label="Modalidad" required>
        <Select
          name="modalidad"
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value as typeof modalidad)}
          required
        >
          <option value="INDIVIDUAL">Individual</option>
          <option value="GRUPAL">Grupal</option>
        </Select>
      </Field>

      <Field label="Duración de la sesión (minutos)" required>
        <Input
          type="number"
          name="duracionMin"
          min={10}
          max={240}
          step={5}
          defaultValue={terapia?.duracionMin ?? 45}
          required
          className="max-w-[10rem]"
        />
        <p className="mt-1 text-xs text-slate-400">
          Define las horas que ofrece el calendario al agendar esta terapia.
        </p>
      </Field>

      {modalidad === "GRUPAL" && (
        <Field label="Máximo de participantes" required>
          <Input
            type="number"
            name="maxParticipantes"
            min={2}
            max={50}
            step={1}
            defaultValue={Math.max(2, terapia?.maxParticipantes ?? 2)}
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            Pacientes que el terapeuta atiende juntos en la misma fecha y hora.
          </p>
        </Field>
      )}

      <Field label="Estado">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={terapia?.activo ?? true}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Terapia activa
        </label>
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : terapia ? "Actualizar" : "Crear terapia"}
        </Button>
        {terapia && (
          <ButtonLink href="/configuracion/terapias" variant="secondary">
            Cancelar
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
