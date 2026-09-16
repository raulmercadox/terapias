"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { guardarConfiguracionCobranza, type FormState } from "../actions";
import { Button, Field, Input } from "@/components/ui";
import { diasDeGracia } from "../../pagos/cobranza";

type TipoGracia = "PORCENTAJE" | "DIAS";

/** Explica la regla con un paquete de 30 días (la primera sesión es el día 1). */
function ejemplo(tipo: TipoGracia, valor: number): string | null {
  if (!Number.isInteger(valor) || valor < 0) return null;
  const gracia = diasDeGracia({ tipo, valor, diasAviso: 0 }, "2026-09-01", "2026-10-01");
  const premisa =
    tipo === "PORCENTAJE"
      ? "Si entre la primera y la última sesión hay 30 días, "
      : "Contando la primera sesión como día 1, ";
  return gracia === 0
    ? `${premisa}el pago debe hacerse antes de la primera sesión.`
    : `${premisa}se puede pagar hasta el día ${gracia} y desde el día ${gracia + 1} queda vencido.`;
}

export function CobranzaForm({
  config,
  guardado,
}: {
  config: { graciaTipo: TipoGracia; graciaValor: number; diasAvisoCobro: number };
  guardado?: boolean;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(guardarConfiguracionCobranza, undefined);
  const [tipo, setTipo] = useState<TipoGracia>(config.graciaTipo);
  const [valor, setValor] = useState(String(config.graciaValor));
  const texto = ejemplo(tipo, Number(valor));

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      <Field label="Periodo de gracia">
        <div className="space-y-2">
          {(
            [
              ["PORCENTAJE", "Porcentaje de la duración de la terapia"],
              ["DIAS", "Días fijos desde la primera sesión"],
            ] as const
          ).map(([valorTipo, etiqueta]) => (
            <label key={valorTipo} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="graciaTipo"
                value={valorTipo}
                checked={tipo === valorTipo}
                onChange={() => setTipo(valorTipo)}
                className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              {etiqueta}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          La duración se cuenta entre la primera y la última sesión tal como se
          agendaron al crear el paquete; las reprogramaciones no la cambian.
        </p>
      </Field>

      <Field label={tipo === "PORCENTAJE" ? "Porcentaje (%)" : "Días"} required>
        <Input
          type="number"
          name="graciaValor"
          min={tipo === "PORCENTAJE" ? 1 : 0}
          max={tipo === "PORCENTAJE" ? 100 : 180}
          step={1}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
          className="max-w-[10rem]"
        />
        {texto && <p className="mt-1 text-xs text-slate-500">{texto}</p>}
      </Field>

      <Field label="Avisar con anticipación (días)" required>
        <Input
          type="number"
          name="diasAvisoCobro"
          min={0}
          max={60}
          step={1}
          defaultValue={config.diasAvisoCobro}
          required
          className="max-w-[10rem]"
        />
        <p className="mt-1 text-xs text-slate-400">
          Desde cuántos días antes de la fecha límite un pago aparece como
          “por vencer” en Cobranza.
        </p>
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {guardado && !state?.error && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Configuración guardada.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
