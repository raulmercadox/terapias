"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { Combobox } from "@/components/combobox";
import { Button, ButtonLink, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { crearCitaRapida, type FormState } from "../actions";

type Opcion = { id: string; nombre: string };

const TIPOS = [
  { valor: "SESION", etiqueta: "Sesión" },
  { valor: "CONSULTA", etiqueta: "Consulta" },
  { valor: "EVALUACION", etiqueta: "Evaluación" },
] as const;

const DURACIONES = [30, 45, 60, 90];

/** Grupo de botones grandes (cómodos en tableta) que se comporta como radio. */
function Opciones<T extends string | number>({
  name,
  opciones,
  valor,
  onCambio,
}: {
  name: string;
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      <input type="hidden" name={name} value={String(valor)} />
      {opciones.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          onClick={() => onCambio(o.valor)}
          className={cn(
            "min-w-20 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
            o.valor === valor
              ? "border-sky-600 bg-sky-600 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

export function CitaRapidaForm({
  pacientes,
  horaInicial,
  puedeCrearPaciente,
}: {
  pacientes: Opcion[];
  horaInicial: string;
  puedeCrearPaciente: boolean;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
    valor,
  } = useFormReintento<FormState>(crearCitaRapida, undefined);
  const [pacienteNuevo, setPacienteNuevo] = useState(false);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["valor"]>("SESION");
  const [duracion, setDuracion] = useState(45);

  return (
    <form key={formKey} {...formProps} className="space-y-5">
      <input type="hidden" name="pacienteNuevo" value={pacienteNuevo ? "1" : "0"} />

      {pacienteNuevo ? (
        <div className="space-y-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-sky-900">Paciente nuevo</p>
            <button
              type="button"
              onClick={() => setPacienteNuevo(false)}
              className="text-sm text-sky-700 underline"
            >
              Elegir uno registrado
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombres" required>
              <Input name="nombres" required autoComplete="off" />
            </Field>
            <Field label="Apellido paterno" required>
              <Input name="apellidoPaterno" required autoComplete="off" />
            </Field>
          </div>
          <Field label="Teléfono">
            <Input name="telefono" type="tel" inputMode="tel" autoComplete="off" />
          </Field>
          <p className="text-xs text-sky-800">
            Recepción completará después el resto de sus datos.
          </p>
        </div>
      ) : (
        <div>
          <Field label="Paciente" required>
            <Combobox
              name="pacienteId"
              required
              options={pacientes}
              defaultValue={valor("pacienteId", "")}
              placeholder="Escribe el nombre o apellido…"
            />
          </Field>
          {puedeCrearPaciente && (
            <button
              type="button"
              onClick={() => setPacienteNuevo(true)}
              className="mt-2 text-sm text-sky-700 underline"
            >
              + Es un paciente nuevo
            </button>
          )}
        </div>
      )}

      <Field label="Tipo">
        <Opciones
          name="tipo"
          opciones={TIPOS.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))}
          valor={tipo}
          onCambio={setTipo}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hora de inicio" required>
          <Input
            type="time"
            name="horaInicio"
            defaultValue={valor("horaInicio", horaInicial)}
            required
            className="py-3 text-base"
          />
        </Field>
        <Field label="Duración">
          <Opciones
            name="duracion"
            opciones={DURACIONES.map((d) => ({ valor: d, etiqueta: `${d} min` }))}
            valor={duracion}
            onCambio={setDuracion}
          />
        </Field>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="px-6 py-3 text-base">
          {pending ? "Registrando…" : "Registrar cita"}
        </Button>
        <ButtonLink href="/citas" variant="secondary" className="px-6 py-3 text-base">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
