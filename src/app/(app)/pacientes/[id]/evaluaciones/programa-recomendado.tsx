"use client";

import { useState } from "react";
import { Card, Field, Textarea } from "@/components/ui";
import {
  TratamientoEditor,
  tratamientoJSON,
  type FilaTratamiento,
  type TerapiaOpcion,
} from "./tratamiento-editor";
import { PLAZO_SEMANAS_DEFECTO } from "./tratamiento";

type Estado = { plazo: string; filas: FilaTratamiento[] };

// La FichaForm remonta su <form> (y con él este cierre) cuando la acción
// devuelve un error; el borrador del tratamiento se guarda aquí, por ficha,
// para no perder las filas ya cargadas.
const borradores = new Map<string, Estado>();

/**
 * Cierre de la ficha de evaluación. NO es parte de la plantilla: el
 * tratamiento sugerido (terapias con sus sesiones en un plazo) sale de la
 * ficha hacia el agendamiento de paquetes, y las recomendaciones son la
 * conclusión del profesional en cualquier rubro.
 */
export function CierreEvaluacion({
  borradorId,
  terapias,
  plazoSemanas,
  tratamiento,
  recomendaciones,
}: {
  /** Identifica la ficha (p. ej. "nueva-<pacienteId>" o el id de la evaluación). */
  borradorId: string;
  terapias: TerapiaOpcion[];
  plazoSemanas?: number;
  tratamiento?: { terapiaId: string; sesiones: number; sesionesSemana: number }[];
  recomendaciones?: string | null;
}) {
  const [estado, setEstado] = useState<Estado>(
    () =>
      borradores.get(borradorId) ?? {
        plazo: String(plazoSemanas ?? PLAZO_SEMANAS_DEFECTO),
        filas: (tratamiento ?? []).map((t, i) => ({
          clave: i + 1,
          terapiaId: t.terapiaId,
          sesiones: String(t.sesiones),
          sesionesSemana: String(t.sesionesSemana),
          semanaManual: true,
        })),
      },
  );
  function actualizar(cambio: Partial<Estado>) {
    setEstado((prev) => {
      const nuevo = { ...prev, ...cambio };
      borradores.set(borradorId, nuevo);
      return nuevo;
    });
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Tratamiento sugerido
      </h2>
      <input type="hidden" name="tratamiento" value={tratamientoJSON(estado.filas)} />
      <TratamientoEditor
        terapias={terapias}
        plazo={estado.plazo}
        onPlazo={(plazo) => actualizar({ plazo })}
        filas={estado.filas}
        onFilas={(filas) => actualizar({ filas })}
      />
      <Field label="Recomendaciones" className="mt-6">
        <Textarea name="recomendaciones" rows={4} defaultValue={recomendaciones ?? ""} />
      </Field>
    </Card>
  );
}
