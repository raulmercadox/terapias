"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Badge,
  EmptyState,
} from "@/components/ui";
import {
  agregarApoderado,
  actualizarApoderado,
  eliminarApoderado,
  type FormState,
} from "./actions";

export type ApoderadoVista = {
  id: string;
  nombres: string;
  apellidos: string | null;
  dni: string | null;
  telefono: string | null;
  correo: string | null;
  vinculo: "MADRE" | "PADRE" | "APODERADO" | "OTRO";
  principal: boolean;
};

const VINCULO_LABEL: Record<string, string> = {
  MADRE: "Madre",
  PADRE: "Padre",
  APODERADO: "Apoderado",
  OTRO: "Otro",
};

function FieldErr({
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

function ApoderadoFields({
  inicial,
  fe,
}: {
  inicial?: ApoderadoVista;
  fe?: Record<string, string>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombres" required>
        <Input name="nombres" defaultValue={inicial?.nombres ?? ""} required />
        <FieldErr errors={fe} name="nombres" />
      </Field>
      <Field label="Apellidos">
        <Input name="apellidos" defaultValue={inicial?.apellidos ?? ""} />
        <FieldErr errors={fe} name="apellidos" />
      </Field>
      <Field label="Vínculo">
        <Select name="vinculo" defaultValue={inicial?.vinculo ?? "APODERADO"}>
          <option value="MADRE">Madre</option>
          <option value="PADRE">Padre</option>
          <option value="APODERADO">Apoderado</option>
          <option value="OTRO">Otro</option>
        </Select>
        <FieldErr errors={fe} name="vinculo" />
      </Field>
      <Field label="DNI">
        <Input name="dni" defaultValue={inicial?.dni ?? ""} inputMode="numeric" />
        <FieldErr errors={fe} name="dni" />
      </Field>
      <Field label="Teléfono">
        <Input name="telefono" defaultValue={inicial?.telefono ?? ""} />
        <FieldErr errors={fe} name="telefono" />
      </Field>
      <Field label="Correo">
        <Input type="email" name="correo" defaultValue={inicial?.correo ?? ""} />
        <FieldErr errors={fe} name="correo" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          name="principal"
          defaultChecked={inicial?.principal ?? false}
          className="h-4 w-4 rounded border-slate-300"
        />
        Marcar como apoderado principal
      </label>
    </div>
  );
}

function AgregarForm({ pacienteId }: { pacienteId: string }) {
  const action = agregarApoderado.bind(null, pacienteId);
  const {
    estado: state,
    pendiente: pending,
    formProps,
  } = useFormReintento<FormState>(action, {});
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <Button variant="secondary" onClick={() => setAbierto(true)}>
        + Agregar apoderado
      </Button>
    );
  }

  return (
    <Card className="border-sky-200">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        Nuevo apoderado
      </h3>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <form {...formProps} className="space-y-3">
        <ApoderadoFields fe={state.fieldErrors} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAbierto(false)}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EditarForm({
  apoderado,
  onCerrar,
}: {
  apoderado: ApoderadoVista;
  onCerrar: () => void;
}) {
  const action = actualizarApoderado.bind(null, apoderado.id);
  const {
    estado: state,
    pendiente: pending,
    formProps,
  } = useFormReintento<FormState>(action, {});

  return (
    <Card className="border-sky-200">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">
        Editar apoderado
      </h3>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <form {...formProps} className="space-y-3">
        <ApoderadoFields inicial={apoderado} fe={state.fieldErrors} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ApoderadoCard({ apoderado }: { apoderado: ApoderadoVista }) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <EditarForm apoderado={apoderado} onCerrar={() => setEditando(false)} />
    );
  }

  const nombre = [apoderado.nombres, apoderado.apellidos]
    .filter(Boolean)
    .join(" ");

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">{nombre}</p>
            {apoderado.principal && <Badge color="sky">Principal</Badge>}
            <Badge color="slate">
              {VINCULO_LABEL[apoderado.vinculo] ?? apoderado.vinculo}
            </Badge>
          </div>
          <dl className="mt-2 space-y-0.5 text-sm text-slate-600">
            <div>DNI: {apoderado.dni ?? "—"}</div>
            <div>Teléfono: {apoderado.telefono ?? "—"}</div>
            <div>Correo: {apoderado.correo ?? "—"}</div>
          </dl>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={() => setEditando(true)}>
            Editar
          </Button>
          <form
            action={async () => {
              await eliminarApoderado(apoderado.id);
            }}
          >
            <Button variant="danger" type="submit">
              Eliminar
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}

export function ApoderadosPanel({
  pacienteId,
  apoderados,
}: {
  pacienteId: string;
  apoderados: ApoderadoVista[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Apoderados</h2>
        <AgregarForm pacienteId={pacienteId} />
      </div>

      {apoderados.length === 0 ? (
        <EmptyState message="Este paciente no tiene apoderados registrados." />
      ) : (
        <div className="space-y-3">
          {apoderados.map((a) => (
            <ApoderadoCard key={a.id} apoderado={a} />
          ))}
        </div>
      )}
    </div>
  );
}
