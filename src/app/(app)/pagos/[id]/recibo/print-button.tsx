"use client";

import { Button, ButtonLink } from "@/components/ui";

export function PrintActions({
  telefono,
  mensaje,
}: {
  /** Teléfono ya normalizado (solo dígitos con prefijo país). null si no hay. */
  telefono: string | null;
  mensaje: string;
}) {
  function enviarPorWhatsApp() {
    if (!telefono) return;
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="no-print flex justify-end gap-2">
      <ButtonLink href="/pagos" variant="secondary">
        Volver a pagos
      </ButtonLink>
      {telefono ? (
        <Button type="button" variant="secondary" onClick={enviarPorWhatsApp}>
          Enviar por WhatsApp
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          disabled
          title="El paciente/apoderado no tiene teléfono registrado"
        >
          Sin teléfono
        </Button>
      )}
      <Button type="button" variant="primary" onClick={() => window.print()}>
        Imprimir
      </Button>
    </div>
  );
}
