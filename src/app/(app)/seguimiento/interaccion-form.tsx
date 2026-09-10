"use client";

import { useState, useTransition } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  registrarInteraccion,
  eliminarInteraccion,
  type FormState,
} from "./actions";
import { CANALES, CANAL_LABEL, aInputLima } from "./seguimiento";

type Direccion = "ENTRADA" | "SALIDA";

function Err({ errors, name }: { errors?: Record<string, string>; name: string }) {
  const msg = errors?.[name];
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function Formulario({
  pacienteId,
  soloSalida,
  onCerrar,
}: {
  pacienteId: string;
  soloSalida: boolean;
  onCerrar: () => void;
}) {
  const action = registrarInteraccion.bind(null, pacienteId);
  const {
    estado: state,
    pendiente: pending,
    formProps,
  } = useFormReintento<FormState>(action, {}, { alExito: onCerrar });
  const [direccion, setDireccion] = useState<Direccion>(
    soloSalida ? "SALIDA" : "ENTRADA",
  );
  // El form solo se monta tras un clic, así que leer la hora aquí no
  // desentona con el HTML del servidor.
  const [ahora] = useState(() => aInputLima(new Date()));
  const fe = state.fieldErrors;

  return (
    <form
      {...formProps}
      className="w-full space-y-3 rounded-lg border border-sky-200 bg-sky-50/40 p-4"
    >
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {soloSalida ? (
          <input type="hidden" name="direccion" value="SALIDA" />
        ) : (
          <Field label="Tipo" required>
            <Select
              name="direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value as Direccion)}
            >
              <option value="ENTRADA">Entrada — el interesado nos buscó</option>
              <option value="SALIDA">Salida — lo contactamos nosotros</option>
            </Select>
          </Field>
        )}
        <Field label="Canal" required>
          <Select name="canal" defaultValue="LLAMADA">
            {CANALES.map((c) => (
              <option key={c} value={c}>
                {CANAL_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha y hora" required>
          <Input type="datetime-local" name="fecha" defaultValue={ahora} required />
          <Err errors={fe} name="fecha" />
        </Field>
        {direccion === "SALIDA" && (
          <Field label="Resultado" required>
            <Select name="resultado" defaultValue="CONTACTADO">
              <option value="CONTACTADO">Contactado — se habló con la familia</option>
              <option value="SIN_RESPUESTA">Sin respuesta — sigue pendiente</option>
            </Select>
            <Err errors={fe} name="resultado" />
          </Field>
        )}
        <Field label="Nota" className="sm:col-span-2">
          <Textarea
            name="nota"
            className="min-h-16"
            placeholder={
              direccion === "ENTRADA"
                ? "Qué pidió, qué se le informó…"
                : "Qué respondió, próximos pasos…"
            }
          />
          <Err errors={fe} name="nota" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Botón que despliega el formulario para registrar una interacción. */
export function RegistrarInteraccion({
  pacienteId,
  soloSalida = false,
  etiqueta = "+ Registrar interacción",
}: {
  pacienteId: string;
  /** En la bandeja solo se registran salidas (el centro contacta al interesado). */
  soloSalida?: boolean;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <Button variant="secondary" onClick={() => setAbierto(true)}>
        {etiqueta}
      </Button>
    );
  }
  return (
    <Formulario
      pacienteId={pacienteId}
      soloSalida={soloSalida}
      onCerrar={() => setAbierto(false)}
    />
  );
}

/** Eliminar en dos pasos: una interacción borrada saca de la bitácora un contacto real. */
export function EliminarInteraccion({ id }: { id: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-xs text-slate-400 hover:text-red-600"
      >
        Eliminar
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-slate-500">¿Eliminar?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => eliminarInteraccion(id))}
        className="font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        Sí
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="text-slate-500 hover:underline"
      >
        No
      </button>
    </span>
  );
}
