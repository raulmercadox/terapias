"use client";

import { useActionState } from "react";
import { Field, Input, Select, Textarea, Button } from "@/components/ui";
import { crearPaquete, type ActionState } from "../actions";

const initial: ActionState = { ok: false };

type Opcion = { id: string; nombre: string };

// Hoy a las 09:00 (hora local) en formato "YYYY-MM-DDTHH:mm" para datetime-local.
function inicioPorDefecto(): string {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export default function NuevoPaqueteForm({
  sedeId,
  pacientes,
  terapeutas,
}: {
  sedeId: string;
  pacientes: Opcion[];
  terapeutas: Opcion[];
}) {
  const [state, formAction, pending] = useActionState(crearPaquete, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sedeId" value={sedeId} />

      <Field label="Paciente" required>
        <Select name="pacienteId" required defaultValue="">
          <option value="" disabled>
            Seleccione un paciente…
          </option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Terapeuta (por defecto, opcional)">
        <Select name="terapeutaId" defaultValue="">
          <option value="">Sin asignar</option>
          {terapeutas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Total de sesiones" required>
          <Input
            type="number"
            name="totalSesiones"
            min={1}
            max={60}
            defaultValue={12}
            required
          />
        </Field>
        <Field label="Frecuencia semanal" required>
          <Select name="frecuenciaSemana" defaultValue="3">
            <option value="1">1 vez por semana (Lun)</option>
            <option value="2">2 veces por semana (Mar, Jue)</option>
            <option value="3">3 veces por semana (Lun, Mié, Vie)</option>
            <option value="4">4 veces por semana (Lun, Mar, Jue, Vie)</option>
            <option value="5">5 veces por semana (Lun a Vie)</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Precio (S/)" required>
          <Input
            type="number"
            name="precio"
            min={0}
            step="0.01"
            placeholder="0.00"
            required
          />
        </Field>
        <Field label="Fecha y hora de inicio" required>
          <Input
            type="datetime-local"
            name="fechaInicio"
            defaultValue={inicioPorDefecto()}
            required
          />
        </Field>
      </div>

      <Field label="Observación (opcional)">
        <Textarea name="observacion" placeholder="Notas del paquete…" />
      </Field>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear paquete"}
        </Button>
      </div>
    </form>
  );
}
