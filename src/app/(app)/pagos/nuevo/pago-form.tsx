"use client";

import { useActionState, useMemo, useState } from "react";
import { registrarPago, type RegistrarPagoState } from "../actions";
import {
  Card,
  Field,
  Input,
  Textarea,
  Select,
  Button,
  ButtonLink,
} from "@/components/ui";

type PacienteOpt = { id: string; nombre: string };
type PaqueteOpt = {
  id: string;
  pacienteId: string;
  etiqueta: string;
};

const CONCEPTOS: { value: string; label: string }[] = [
  { value: "PAQUETE_SESIONES", label: "Paquete de sesiones" },
  { value: "MENSUALIDAD", label: "Mensualidad" },
  { value: "MATRICULA", label: "Matrícula" },
  { value: "MATERIALES", label: "Materiales" },
  { value: "EVALUACION", label: "Evaluación" },
  { value: "OTRO", label: "Otro" },
];

const METODOS: { value: string; label: string }[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "YAPE", label: "Yape" },
  { value: "PLIN", label: "Plin" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "TARJETA", label: "Tarjeta" },
];

const initialState: RegistrarPagoState = {};

export function PagoForm({
  pacientes,
  paquetes,
  hoy,
}: {
  pacientes: PacienteOpt[];
  paquetes: PaqueteOpt[];
  hoy: string;
}) {
  const [state, formAction, pending] = useActionState(registrarPago, initialState);
  const [pacienteId, setPacienteId] = useState("");

  const paquetesPaciente = useMemo(
    () => paquetes.filter((p) => p.pacienteId === pacienteId),
    [paquetes, pacienteId],
  );

  return (
    <form action={formAction} className="space-y-5">
      <Card className="space-y-4">
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <Field label="Paciente" required>
          <Select
            name="pacienteId"
            required
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
          >
            <option value="">— Selecciona —</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Paquete vinculado (opcional)">
          <Select name="paqueteId" disabled={paquetesPaciente.length === 0}>
            <option value="">— Sin vincular —</option>
            {paquetesPaciente.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etiqueta}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Concepto" required>
            <Select name="concepto" defaultValue="PAQUETE_SESIONES" required>
              {CONCEPTOS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Método de pago" required>
            <Select name="metodoPago" defaultValue="EFECTIVO" required>
              {METODOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Descripción (opcional)">
          <Textarea name="descripcion" placeholder="Detalle del pago…" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Monto (S/)" required>
            <Input
              name="monto"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              required
            />
          </Field>

          <Field label="Saldo (S/)">
            <Input
              name="saldo"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              defaultValue="0"
            />
          </Field>

          <Field label="Fecha de pago" required>
            <Input name="fechaPago" type="date" defaultValue={hoy} required />
          </Field>
        </div>

        <Field label="Referencia (operación / banco, opcional)">
          <Input name="referencia" placeholder="Ej: Op. 0001234 — BCP" />
        </Field>
      </Card>

      <div className="flex justify-end gap-2">
        <ButtonLink href="/pagos" variant="secondary">
          Cancelar
        </ButtonLink>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Registrar pago"}
        </Button>
      </div>
    </form>
  );
}
