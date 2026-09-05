"use client";

import { useEffect, useRef, useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { Button, Field, Textarea } from "@/components/ui";
import { fechaHora } from "@/lib/utils";
import { registrarSeguimiento, type FormState } from "./actions";

export type ObservacionVista = {
  id: string;
  texto: string;
  autor: string | null;
  createdAt: string; // ISO
};

export function SeguimientoForm({
  citaId,
  terapiaRealizada,
  observaciones,
}: {
  citaId: string;
  terapiaRealizada: string | null;
  observaciones: ObservacionVista[];
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
  } = useFormReintento<FormState>(registrarSeguimiento, undefined);

  const [nuevaObservacion, setNuevaObservacion] = useState("");

  // Limpia el campo de nueva observación tras un registro exitoso.
  const prevPending = useRef(pending);
  useEffect(() => {
    if (prevPending.current && !pending && !state?.error) {
      setNuevaObservacion("");
    }
    prevPending.current = pending;
  }, [pending, state]);

  return (
    <form {...formProps} className="space-y-5">
      <input type="hidden" name="id" value={citaId} />

      <Field label="Terapia realizada">
        <Textarea
          name="terapiaRealizada"
          defaultValue={terapiaRealizada ?? ""}
          placeholder="Describe la terapia o actividades realizadas…"
        />
      </Field>

      {/* Historial de observaciones (solo lectura) */}
      <div className="space-y-2">
        <p className="block text-sm font-medium text-slate-700">
          Historial de observaciones
        </p>
        {observaciones.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
            Aún no hay observaciones registradas.
          </p>
        ) : (
          <ul className="space-y-2">
            {observaciones.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-600">
                    {o.autor ?? "—"}
                  </span>
                  <time dateTime={o.createdAt}>{fechaHora(o.createdAt)}</time>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                  {o.texto}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label="Agregar observación">
        <Textarea
          name="observacion"
          value={nuevaObservacion}
          onChange={(e) => setNuevaObservacion(e.target.value)}
          placeholder="Escribe una nueva observación. Quedará registrada con fecha y hora y no podrá editarse."
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
