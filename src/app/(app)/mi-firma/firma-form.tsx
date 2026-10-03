"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { FirmaPad } from "@/components/firma-pad";
import { Button } from "@/components/ui";
import { guardarMiFirma, type FirmaState } from "./actions";

export function FirmaForm({ tieneFirma }: { tieneFirma: boolean }) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FirmaState>(guardarMiFirma, undefined);
  const [hayFirma, setHayFirma] = useState(false);

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      <FirmaPad name="firma" onCambio={setHayFirma} />

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending || !hayFirma}>
        {pending
          ? "Guardando…"
          : tieneFirma
            ? "Reemplazar mi firma"
            : "Guardar mi firma"}
      </Button>
    </form>
  );
}
