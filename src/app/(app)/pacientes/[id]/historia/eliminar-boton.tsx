"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { eliminarHistoria } from "./actions";

export function EliminarHistoriaBoton({ historiaId }: { historiaId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("¿Eliminar la historia clínica de este paciente? Esta acción no se puede deshacer.")) {
          return;
        }
        startTransition(() => eliminarHistoria(historiaId));
      }}
    >
      {pending ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
