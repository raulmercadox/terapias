"use client";

import { Button, Field, Input, Select } from "@/components/ui";
import { sesionesSemanaSugeridas } from "./tratamiento";

export type TerapiaOpcion = {
  id: string;
  nombre: string;
  especialidad: string | null;
  modalidad: "INDIVIDUAL" | "GRUPAL";
  maxParticipantes: number;
};

/** Fila editable del tratamiento (los números como texto, tal cual se tipean). */
export type FilaTratamiento = {
  clave: number;
  terapiaId: string;
  sesiones: string;
  sesionesSemana: string;
  /** El usuario cambió "por semana": ya no se recalcula sola. */
  semanaManual: boolean;
};

export function etiquetaTerapia(t: TerapiaOpcion): string {
  const partes = [t.nombre];
  if (t.especialidad) partes.push(t.especialidad);
  partes.push(t.modalidad === "GRUPAL" ? `Grupal (máx. ${t.maxParticipantes})` : "Individual");
  return partes.join(" · ");
}

/** JSON que espera la acción: [{ terapiaId, sesiones, sesionesSemana }]. */
export function tratamientoJSON(filas: FilaTratamiento[]): string {
  return JSON.stringify(
    filas.map((f) => ({
      terapiaId: f.terapiaId,
      sesiones: f.sesiones,
      sesionesSemana: f.sesionesSemana,
    })),
  );
}

/**
 * Sección "Tratamiento sugerido": plazo en semanas y una fila por terapia con
 * sus sesiones. Es controlada desde el formulario de la evaluación (el estado
 * vive allá para sobrevivir al remontaje tras un error).
 */
export function TratamientoEditor({
  terapias,
  plazo,
  onPlazo,
  filas,
  onFilas,
}: {
  terapias: TerapiaOpcion[];
  plazo: string;
  onPlazo: (v: string) => void;
  filas: FilaTratamiento[];
  onFilas: (f: FilaTratamiento[]) => void;
}) {
  const plazoNum = Number(plazo) || 0;

  function cambiarPlazo(v: string) {
    onPlazo(v);
    const n = Number(v) || 0;
    onFilas(
      filas.map((f) =>
        f.semanaManual
          ? f
          : { ...f, sesionesSemana: String(sesionesSemanaSugeridas(Number(f.sesiones), n)) },
      ),
    );
  }

  function cambiarFila(clave: number, cambio: Partial<FilaTratamiento>) {
    onFilas(
      filas.map((f) => {
        if (f.clave !== clave) return f;
        const nueva = { ...f, ...cambio };
        if (cambio.sesiones !== undefined && !nueva.semanaManual) {
          nueva.sesionesSemana = String(
            sesionesSemanaSugeridas(Number(nueva.sesiones), plazoNum),
          );
        }
        return nueva;
      }),
    );
  }

  function agregar() {
    const clave = Math.max(0, ...filas.map((f) => f.clave)) + 1;
    onFilas([
      ...filas,
      {
        clave,
        terapiaId: "",
        sesiones: "8",
        sesionesSemana: String(sesionesSemanaSugeridas(8, plazoNum)),
        semanaManual: false,
      },
    ]);
  }

  const usadas = new Set(filas.map((f) => f.terapiaId));

  return (
    <div className="space-y-4">
      <Field label="Plazo del tratamiento (semanas)" className="max-w-xs">
        <Input
          type="number"
          name="plazoSemanas"
          min={1}
          max={26}
          value={plazo}
          onChange={(e) => cambiarPlazo(e.target.value)}
        />
      </Field>

      {filas.length === 0 ? (
        <p className="text-sm text-slate-500">
          Sin terapias sugeridas. Agrega las terapias que el paciente debe seguir:
          se usarán al programar su paquete.
        </p>
      ) : (
        <div className="space-y-3">
          {filas.map((f) => (
            <div
              key={f.clave}
              className="grid items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_7rem_7rem_auto]"
            >
              <Field label="Terapia">
                <Select
                  value={f.terapiaId}
                  onChange={(e) => cambiarFila(f.clave, { terapiaId: e.target.value })}
                >
                  <option value="">— Seleccione —</option>
                  {terapias.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      disabled={t.id !== f.terapiaId && usadas.has(t.id)}
                    >
                      {etiquetaTerapia(t)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sesiones">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={f.sesiones}
                  onChange={(e) => cambiarFila(f.clave, { sesiones: e.target.value })}
                />
              </Field>
              <Field label="Por semana">
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={f.sesionesSemana}
                  onChange={(e) =>
                    cambiarFila(f.clave, {
                      sesionesSemana: e.target.value,
                      semanaManual: true,
                    })
                  }
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onFilas(filas.filter((x) => x.clave !== f.clave))}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={agregar}
        disabled={terapias.length === 0 || filas.length >= terapias.length}
      >
        + Agregar terapia
      </Button>
      {terapias.length === 0 && (
        <p className="text-xs text-amber-700">
          No hay terapias activas en la sede. Configúralas en Configuración ›
          Terapias.
        </p>
      )}
    </div>
  );
}
