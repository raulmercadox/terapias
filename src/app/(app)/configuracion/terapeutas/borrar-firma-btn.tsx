"use client";

import { useFormReintento } from "@/components/form-reintento";
import { borrarFirmaTerapeuta, type FormState } from "../actions";
import { Button } from "@/components/ui";

export function BorrarFirmaBtn({ id }: { id: string }) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(borrarFirmaTerapeuta, undefined);

  return (
    <form
      key={formKey}
      {...formProps}
      onSubmit={(e) => {
        if (
          !confirm(
            "¿Borrar la firma? El terapeuta tendrá que dibujarla de nuevo.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Borrando…" : "Borrar firma"}
      </Button>
      {state?.error && (
        <span className="ml-2 text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
