"use client";

import { useFormReintento } from "@/components/form-reintento";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { FormState } from "./actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type PacienteInicial = {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string | null;
  dni?: string | null;
  fechaNacimiento?: string | null; // formato yyyy-mm-dd
  sexo?: "M" | "F" | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  distrito?: string | null;
  fotoUrl?: string | null;
  programa?: "ESCOLAR" | "INTERDIARIO" | "TERAPIAS";
  diagnostico?: string | null;
  observaciones?: string | null;
};

function Err({
  errors,
  name,
}: {
  errors?: Record<string, string>;
  name: string;
}) {
  const msg = errors?.[name];
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

export function PacienteForm({
  action,
  inicial,
  modo,
}: {
  action: Action;
  inicial?: PacienteInicial;
  modo: "crear" | "editar";
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
  } = useFormReintento<FormState>(action, {});
  const fe = state.fieldErrors;
  const v = inicial ?? {};

  return (
    <form {...formProps} className="space-y-6">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Datos del paciente
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombres" required>
            <Input name="nombres" defaultValue={v.nombres ?? ""} required />
            <Err errors={fe} name="nombres" />
          </Field>
          <Field label="Apellido paterno" required>
            <Input
              name="apellidoPaterno"
              defaultValue={v.apellidoPaterno ?? ""}
              required
            />
            <Err errors={fe} name="apellidoPaterno" />
          </Field>
          <Field label="Apellido materno">
            <Input
              name="apellidoMaterno"
              defaultValue={v.apellidoMaterno ?? ""}
            />
            <Err errors={fe} name="apellidoMaterno" />
          </Field>
          <Field label="DNI">
            <Input name="dni" defaultValue={v.dni ?? ""} inputMode="numeric" />
            <Err errors={fe} name="dni" />
          </Field>
          <Field label="Fecha de nacimiento">
            <Input
              type="date"
              name="fechaNacimiento"
              defaultValue={v.fechaNacimiento ?? ""}
            />
            <Err errors={fe} name="fechaNacimiento" />
          </Field>
          <Field label="Sexo">
            <Select name="sexo" defaultValue={v.sexo ?? ""}>
              <option value="">— Seleccione —</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </Select>
            <Err errors={fe} name="sexo" />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Contacto
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono">
            <Input name="telefono" defaultValue={v.telefono ?? ""} />
            <Err errors={fe} name="telefono" />
          </Field>
          <Field label="Correo">
            <Input type="email" name="correo" defaultValue={v.correo ?? ""} />
            <Err errors={fe} name="correo" />
          </Field>
          <Field label="Dirección">
            <Input name="direccion" defaultValue={v.direccion ?? ""} />
            <Err errors={fe} name="direccion" />
          </Field>
          <Field label="Distrito">
            <Input name="distrito" defaultValue={v.distrito ?? ""} />
            <Err errors={fe} name="distrito" />
          </Field>
          <Field label="URL de foto" className="sm:col-span-2">
            <Input
              name="fotoUrl"
              defaultValue={v.fotoUrl ?? ""}
              placeholder="https://..."
            />
            <Err errors={fe} name="fotoUrl" />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Información clínica
        </h2>
        <div className="grid gap-4">
          <Field label="Diagnóstico">
            <Textarea name="diagnostico" defaultValue={v.diagnostico ?? ""} />
            <Err errors={fe} name="diagnostico" />
          </Field>
          <Field label="Observaciones">
            <Textarea
              name="observaciones"
              defaultValue={v.observaciones ?? ""}
            />
            <Err errors={fe} name="observaciones" />
          </Field>
        </div>
      </Card>

      {modo === "crear" && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Apoderado principal (opcional)
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Puedes registrar a la madre, el padre o un apoderado ahora. Podrás
            gestionar más apoderados desde el detalle del paciente.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombres del apoderado">
              <Input name="apo_nombres" />
              <Err errors={fe} name="apo_nombres" />
            </Field>
            <Field label="Apellidos del apoderado">
              <Input name="apo_apellidos" />
              <Err errors={fe} name="apo_apellidos" />
            </Field>
            <Field label="Vínculo">
              <Select name="apo_vinculo" defaultValue="MADRE">
                <option value="MADRE">Madre</option>
                <option value="PADRE">Padre</option>
                <option value="APODERADO">Apoderado</option>
                <option value="OTRO">Otro</option>
              </Select>
              <Err errors={fe} name="apo_vinculo" />
            </Field>
            <Field label="DNI del apoderado">
              <Input name="apo_dni" inputMode="numeric" />
              <Err errors={fe} name="apo_dni" />
            </Field>
            <Field label="Teléfono del apoderado">
              <Input name="apo_telefono" />
              <Err errors={fe} name="apo_telefono" />
            </Field>
            <Field label="Correo del apoderado">
              <Input type="email" name="apo_correo" />
              <Err errors={fe} name="apo_correo" />
            </Field>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Guardando..."
            : modo === "crear"
              ? "Registrar paciente"
              : "Guardar cambios"}
        </Button>
        <ButtonLink href="/pacientes" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
