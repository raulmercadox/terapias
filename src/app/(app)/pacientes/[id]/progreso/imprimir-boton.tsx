"use client";

import { Button } from "@/components/ui";

export function ImprimirBoton() {
  return (
    <div className="no-print flex justify-end">
      <Button type="button" variant="primary" onClick={() => window.print()}>
        Imprimir
      </Button>
    </div>
  );
}
