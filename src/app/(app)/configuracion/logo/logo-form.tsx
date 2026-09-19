"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { quitarLogoCentro, subirLogoCentro, type FormState } from "../actions";
import { Button } from "@/components/ui";
import { CentroLogo } from "@/components/centro-logo";
import { LOGO_MAX_BYTES, LOGO_TIPOS } from "@/lib/logo";

export function LogoForm({
  logoActualizadoEn,
  guardado,
}: {
  logoActualizadoEn: Date | null;
  guardado?: boolean;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(subirLogoCentro, undefined);
  // Se valida antes de enviar: un archivo grande chocaría con el límite de 1 MB
  // de las server actions y fallaría sin un mensaje entendible.
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const error = errorLocal ?? state?.error;

  function revisar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    setListo(false);
    setErrorLocal(null);
    if (!archivo) return;
    if (!(LOGO_TIPOS as readonly string[]).includes(archivo.type)) {
      setErrorLocal("Formato no admitido. Usa PNG, JPG o WebP.");
      e.target.value = "";
    } else if (archivo.size > LOGO_MAX_BYTES) {
      setErrorLocal("El logo no puede superar 450 KB.");
      e.target.value = "";
    } else {
      setListo(true);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex h-28 w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-3">
        {logoActualizadoEn ? (
          <CentroLogo logoActualizadoEn={logoActualizadoEn} className="h-full w-auto max-w-full" />
        ) : (
          <span className="text-sm text-slate-400">Sin logo</span>
        )}
      </div>

      <form key={formKey} {...formProps} className="space-y-3">
        <input
          type="file"
          name="logo"
          accept={LOGO_TIPOS.join(",")}
          onChange={revisar}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
        />
        <p className="text-xs text-slate-500">PNG, JPG o WebP, máximo 450 KB. Mejor si es horizontal o cuadrado con fondo transparente o blanco.</p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {guardado && !error && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Logo guardado.</p>
        )}

        <Button type="submit" disabled={pending || !listo}>
          {pending ? "Guardando…" : logoActualizadoEn ? "Reemplazar logo" : "Subir logo"}
        </Button>
      </form>

      {logoActualizadoEn && (
        <form action={quitarLogoCentro}>
          <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700">
            Quitar logo
          </button>
        </form>
      )}
    </div>
  );
}
