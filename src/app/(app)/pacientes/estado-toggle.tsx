"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { cambiarEstado } from "./actions";

export function EstadoToggle({
  pacienteId,
  estado,
}: {
  pacienteId: string;
  estado: "ACTIVO" | "BAJA";
}) {
  const [pending, startTransition] = useTransition();
  const nuevo = estado === "ACTIVO" ? "BAJA" : "ACTIVO";

  return (
    <Button
      variant={estado === "ACTIVO" ? "danger" : "primary"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await cambiarEstado(pacienteId, nuevo);
        })
      }
    >
      {pending
        ? "Actualizando..."
        : estado === "ACTIVO"
          ? "Dar de baja"
          : "Reactivar"}
    </Button>
  );
}
