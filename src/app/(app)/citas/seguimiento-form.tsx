"use client";

import { useActionState } from "react";
import { Button, Field, Textarea } from "@/components/ui";
import { registrarSeguimiento, type FormState } from "./actions";

export function SeguimientoForm({
  citaId,
  terapiaRealizada,
  observacion,
}: {
  citaId: string;
  terapiaRealizada: string | null;
  observacion: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registrarSeguimiento,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={citaId} />

      <Field label="Terapia realizada">
        <Textarea
          name="terapiaRealizada"
          defaultValue={terapiaRealizada ?? ""}
          placeholder="Describe la terapia o actividades realizadas…"
        />
      </Field>

      <Field label="Observación">
        <Textarea
          name="observacion"
          defaultValue={observacion ?? ""}
          placeholder="Notas adicionales…"
        />
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar seguimiento"}
      </Button>
    </form>
  );
}
