"use client";

import { useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Campo, Escala, ValorCampo } from "@/lib/fichas/tipos";
import { nombreCampo, nombreColumna, nombreItem, nombreObs } from "./form-datos";

/* ── Helpers de lectura del valor guardado ─────────────── */

const textoDe = (v?: ValorCampo) => (v?.t === "texto" ? v.v : "");
const casillaDe = (v?: ValorCampo) => (v?.t === "casilla" ? v.v : false);
const opcionesDe = (v?: ValorCampo) => (v?.t === "opciones" ? v.v : []);
const filasDe = (v?: ValorCampo) => (v?.t === "tabla" ? v.filas : []);
const itemsDe = (v?: ValorCampo) => (v?.t === "checklist" ? v.items : {});

/* ── Tabla de filas variables ──────────────────────────── */

function TablaCampo({
  campo,
  valor,
}: {
  campo: Extract<Campo, { tipo: "tabla" }>;
  valor?: ValorCampo;
}) {
  const guardadas = filasDe(valor);
  const iniciales =
    guardadas.length > 0 ? guardadas : (campo.filasSugeridas ?? [{}]);
  const [filas, setFilas] = useState<Record<string, string>[]>(iniciales);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              {campo.columnas.map((c) => (
                <th key={c.id} className={cn("pb-2 pr-2", c.ancho === "corto" && "w-16")}>
                  {c.label}
                </th>
              ))}
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i} className="align-top">
                {campo.columnas.map((c) => (
                  <td key={c.id} className="py-1 pr-2">
                    <Input
                      name={nombreColumna(campo.id, c.id)}
                      defaultValue={fila[c.id] ?? ""}
                      aria-label={`${c.label} (fila ${i + 1})`}
                    />
                  </td>
                ))}
                <td className="py-1">
                  <button
                    type="button"
                    onClick={() => setFilas(filas.filter((_, j) => j !== i))}
                    className="rounded px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
                    aria-label={`Quitar fila ${i + 1}`}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="secondary" onClick={() => setFilas([...filas, {}])}>
        Agregar fila
      </Button>
    </div>
  );
}

/* ── Checklist con escala ──────────────────────────────── */

function ChecklistCampo({
  campo,
  valor,
  escala,
  conObservacion,
}: {
  campo: Extract<Campo, { tipo: "checklist" }>;
  valor?: ValorCampo;
  escala: Escala | null;
  conObservacion: boolean;
}) {
  const registrados = itemsDe(valor);
  if (!escala) return null;

  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {campo.items.map((item) => {
        const actual = registrados[item.id];
        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <span className="text-sm text-slate-700">{item.label}</span>
            <div className="flex flex-wrap items-center gap-3">
              {conObservacion && (
                <Input
                  name={nombreObs(item.id)}
                  defaultValue={actual?.obs ?? ""}
                  placeholder="Observación"
                  className="w-40 py-1"
                  aria-label={`Observación de ${item.label}`}
                />
              )}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-slate-400">
                  <input
                    type="radio"
                    name={nombreItem(item.id)}
                    value=""
                    defaultChecked={!actual?.valor}
                  />
                  —
                </label>
                {escala.valores.map((v) => (
                  <label
                    key={v}
                    className="flex items-center gap-1 text-sm text-slate-700"
                    title={escala.labels[v]}
                  >
                    <input
                      type="radio"
                      name={nombreItem(item.id)}
                      value={v}
                      defaultChecked={actual?.valor === v}
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Campo genérico ────────────────────────────────────── */

export function CampoFicha({
  campo,
  valor,
  escala,
  conObservacion,
  onCambio,
}: {
  campo: Campo;
  valor?: ValorCampo;
  escala: Escala | null;
  conObservacion: boolean;
  /** Avisa del valor elegido cuando otro grupo depende de este campo. */
  onCambio?: (valores: string[]) => void;
}) {
  switch (campo.tipo) {
    case "texto":
      return (
        <Field label={campo.label} className={campo.ancho === "completo" ? "sm:col-span-2" : undefined}>
          <Input name={nombreCampo(campo.id)} defaultValue={textoDe(valor)} />
          {campo.ayuda && <p className="mt-1 text-xs text-slate-400">{campo.ayuda}</p>}
        </Field>
      );

    case "parrafo":
      return (
        <Field label={campo.label} className="sm:col-span-2">
          <Textarea
            name={nombreCampo(campo.id)}
            defaultValue={textoDe(valor)}
            rows={campo.filas}
          />
          {campo.ayuda && <p className="mt-1 text-xs text-slate-400">{campo.ayuda}</p>}
        </Field>
      );

    case "casilla":
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            name={nombreCampo(campo.id)}
            defaultChecked={casillaDe(valor)}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          {campo.label}
        </label>
      );

    case "opciones": {
      const elegidos = opcionesDe(valor);
      return (
        <Field label={campo.label} className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {campo.multiple ? null : (
              // Opción "sin elegir" para poder dejar la pregunta en blanco.
              <label className="flex items-center gap-1 text-xs text-slate-400">
                <input
                  type="radio"
                  name={nombreCampo(campo.id)}
                  value=""
                  defaultChecked={elegidos.length === 0}
                  onChange={() => onCambio?.([])}
                />
                —
              </label>
            )}
            {campo.opciones.map((o) => (
              <label key={o.valor} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type={campo.multiple ? "checkbox" : "radio"}
                  name={nombreCampo(campo.id)}
                  value={o.valor}
                  defaultChecked={elegidos.includes(o.valor)}
                  onChange={(e) => {
                    if (!onCambio) return;
                    onCambio(
                      campo.multiple
                        ? e.currentTarget.checked
                          ? [...elegidos, o.valor]
                          : elegidos.filter((v) => v !== o.valor)
                        : [o.valor],
                    );
                  }}
                  className={campo.multiple ? "h-4 w-4 rounded border-slate-300" : undefined}
                />
                {o.label}
              </label>
            ))}
          </div>
          {campo.ayuda && <p className="mt-1 text-xs text-slate-400">{campo.ayuda}</p>}
        </Field>
      );
    }

    case "tabla":
      return (
        <div className="sm:col-span-2">
          <TablaCampo campo={campo} valor={valor} />
        </div>
      );

    case "checklist":
      return (
        <div className="sm:col-span-2">
          {campo.label && (
            <h4 className="mb-2 text-sm font-medium text-slate-600">{campo.label}</h4>
          )}
          <ChecklistCampo
            campo={campo}
            valor={valor}
            escala={escala}
            conObservacion={conObservacion}
          />
        </div>
      );
  }
}
