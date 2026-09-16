"use client";

import { Button } from "@/components/ui";

/**
 * Abre el diálogo de impresión del navegador. Lo imprimible se marca con
 * `print-area` y lo que no debe salir en papel con `no-print` (CSS en
 * globals.css).
 */
export function ImprimirBoton({ children = "Imprimir" }: { children?: React.ReactNode }) {
  return (
    <Button variant="secondary" type="button" onClick={() => window.print()}>
      {children}
    </Button>
  );
}
