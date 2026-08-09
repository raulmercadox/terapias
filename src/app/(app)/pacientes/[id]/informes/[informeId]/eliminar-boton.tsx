"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { eliminarInforme } from "../actions";

export function EliminarInformeBoton({ informeId }: { informeId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            "¿Eliminar este informe de avance? Esta acción no se puede deshacer.",
          )
        ) {
          return;
        }
        startTransition(() => eliminarInforme(informeId));
      }}
    >
      {pending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
