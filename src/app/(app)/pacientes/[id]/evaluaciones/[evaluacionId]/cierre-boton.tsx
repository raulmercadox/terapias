"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { cambiarCierreEvaluacion } from "../actions";

export function CierreEvaluacionBoton({
  evaluacionId,
  cerrada,
}: {
  evaluacionId: string;
  cerrada: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (
            !cerrada &&
            !window.confirm(
              "¿Cerrar esta evaluación? Ya no se podrá usar para crear ni renovar paquetes (podrás reabrirla).",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const res = await cambiarCierreEvaluacion(evaluacionId, !cerrada);
            if (res.error) setError(res.error);
          });
        }}
      >
        {pending ? "Guardando…" : cerrada ? "Reabrir" : "Cerrar evaluación"}
      </Button>
      {error && (
        <span className="max-w-xs text-right text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
