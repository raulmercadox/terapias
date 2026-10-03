"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { Button, Field, Input, Select } from "@/components/ui";
import { registrarCobroCita, type CobroState } from "./actions";

const METODOS = [
  { valor: "EFECTIVO", etiqueta: "Efectivo" },
  { valor: "YAPE", etiqueta: "Yape" },
  { valor: "PLIN", etiqueta: "Plin" },
  { valor: "TRANSFERENCIA", etiqueta: "Transferencia" },
  { valor: "TARJETA", etiqueta: "Tarjeta" },
];

/** Cobro de una cita suelta por el propio terapeuta (permiso REGISTRAR_COBRO). */
export function CobroForm({ citaId }: { citaId: string }) {
  const [abierto, setAbierto] = useState(false);
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<CobroState>(
    registrarCobroCita.bind(null, citaId),
    undefined,
  );

  if (!abierto) {
    return (
      <Button type="button" variant="secondary" onClick={() => setAbierto(true)}>
        Registrar cobro
      </Button>
    );
  }

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monto (S/)" required>
          <Input
            type="number"
            name="monto"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            required
          />
        </Field>
        <Field label="Método" required>
          <Select name="metodoPago" defaultValue="EFECTIVO">
            {METODOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="N° de operación (Yape, Plin, transferencia…)">
        <Input name="referencia" autoComplete="off" />
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando…" : "Registrar cobro"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
