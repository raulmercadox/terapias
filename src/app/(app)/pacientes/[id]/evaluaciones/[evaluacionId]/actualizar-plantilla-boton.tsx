"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { actualizarAPlantillaVigente } from "../actions";

/**
 * Pasa la ficha a la plantilla vigente del centro. Es explícito a propósito:
 * una evaluación firmada no cambia sola porque alguien edite Configuración.
 */
export function ActualizarPlantillaBoton({ evaluacionId }: { evaluacionId: string }) {
  const [pendiente, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      type="button"
      disabled={pendiente}
      onClick={() =>
        startTransition(() => {
          void actualizarAPlantillaVigente(evaluacionId);
        })
      }
    >
      {pendiente ? "Actualizando…" : "Actualizar a la plantilla vigente"}
    </Button>
  );
}
