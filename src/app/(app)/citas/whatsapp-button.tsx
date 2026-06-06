"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { marcarRecordatorioEnviado } from "./actions";

export function WhatsAppButton({
  citaId,
  telefono,
  mensaje,
  variant = "secondary",
  marcarEnviado = true,
  children = "Recordar por WhatsApp",
}: {
  citaId: string;
  /** Teléfono ya normalizado (solo dígitos, con prefijo país). null si no hay. */
  telefono: string | null;
  mensaje: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  marcarEnviado?: boolean;
  children?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  if (!telefono) {
    return (
      <Button variant="ghost" disabled title="Sin teléfono registrado">
        Sin teléfono
      </Button>
    );
  }

  const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

  function handleClick() {
    window.open(url, "_blank", "noopener,noreferrer");
    if (marcarEnviado) {
      const fd = new FormData();
      fd.set("id", citaId);
      startTransition(() => {
        void marcarRecordatorioEnviado(fd);
      });
    }
  }

  return (
    <Button variant={variant} type="button" onClick={handleClick} disabled={pending}>
      {children}
    </Button>
  );
}
