"use client";

import { Button } from "@/components/ui";
import { eliminarCita } from "./actions";

export function DeleteButton({ citaId }: { citaId: string }) {
  return (
    <form
      action={eliminarCita}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar esta cita? Esta acción no se puede deshacer.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={citaId} />
      <Button type="submit" variant="danger">
        Eliminar
      </Button>
    </form>
  );
}
