"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { eliminarEvaluacion } from "../actions";

export function EliminarEvaluacionBoton({ evaluacionId }: { evaluacionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("¿Eliminar esta ficha de evaluación? Esta acción no se puede deshacer.")) {
          return;
        }
        startTransition(() => eliminarEvaluacion(evaluacionId));
      }}
    >
      {pending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
