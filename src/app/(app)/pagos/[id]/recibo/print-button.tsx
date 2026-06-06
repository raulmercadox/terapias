"use client";

import { Button, ButtonLink } from "@/components/ui";

export function PrintActions() {
  return (
    <div className="no-print flex justify-end gap-2">
      <ButtonLink href="/pagos" variant="secondary">
        Volver a pagos
      </ButtonLink>
      <Button type="button" variant="primary" onClick={() => window.print()}>
        Imprimir
      </Button>
    </div>
  );
}
