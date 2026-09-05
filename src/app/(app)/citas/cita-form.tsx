"use client";

import { useFormReintento } from "@/components/form-reintento";
import { Button, ButtonLink, Field, Input, Select, Textarea } from "@/components/ui";
import { Combobox } from "@/components/combobox";
import { crearCita, actualizarCita, type FormState } from "./actions";

type Opcion = { id: string; nombre: string };

export type CitaInicial = {
  id: string;
  pacienteId: string;
  terapeutaId: string | null;
  fecha: string; // "YYYY-MM-DD"
  horaInicio: string;
  horaFin: string;
  tipo: "CONSULTA" | "EVALUACION" | "SESION";
  observacion: string | null;
};

export function CitaForm({
  pacientes,
  terapeutas,
  inicial,
  fechaPorDefecto,
}: {
  pacientes: Opcion[];
  terapeutas: Opcion[];
  inicial?: CitaInicial;
  fechaPorDefecto?: string;
}) {
  const editando = Boolean(inicial);
  const action = editando ? actualizarCita : crearCita;
  const {
    estado: state,
    pendiente: pending,
    formProps,
    valor,
  } = useFormReintento<FormState>(action, undefined);

  const cancelHref = editando ? `/citas/${inicial!.id}` : "/citas";

  return (
    <form {...formProps} className="space-y-4">
      {editando && <input type="hidden" name="id" value={inicial!.id} />}

      <Field label="Paciente" required>
        {/* El Combobox guarda su valor en estado propio, así que al remontar el
            form hay que devolvérselo desde el borrador. */}
        <Combobox
          name="pacienteId"
          required
          options={pacientes}
          defaultValue={valor("pacienteId", inicial?.pacienteId ?? "")}
          placeholder="Seleccione un paciente…"
        />
      </Field>

      <Field label="Terapeuta">
        <Select name="terapeutaId" defaultValue={inicial?.terapeutaId ?? ""}>
          <option value="">Sin asignar</option>
          {terapeutas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Tipo de cita" required>
        <Select name="tipo" defaultValue={inicial?.tipo ?? "SESION"} required>
          <option value="CONSULTA">Consulta</option>
          <option value="EVALUACION">Evaluación</option>
          <option value="SESION">Sesión</option>
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha" required>
          <Input
            type="date"
            name="fecha"
            defaultValue={inicial?.fecha ?? fechaPorDefecto ?? ""}
            required
          />
        </Field>
        <Field label="Hora inicio" required>
          <Input
            type="time"
            name="horaInicio"
            defaultValue={inicial?.horaInicio ?? "09:00"}
            required
          />
        </Field>
        <Field label="Hora fin" required>
          <Input
            type="time"
            name="horaFin"
            defaultValue={inicial?.horaFin ?? "09:45"}
            required
          />
        </Field>
      </div>

      <Field label="Observación">
        <Textarea
          name="observacion"
          defaultValue={inicial?.observacion ?? ""}
          placeholder="Notas opcionales sobre la cita…"
        />
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : editando ? "Guardar cambios" : "Agendar cita"}
        </Button>
        <ButtonLink href={cancelHref} variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
