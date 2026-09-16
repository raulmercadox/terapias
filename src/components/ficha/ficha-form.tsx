"use client";

import { useState, type ReactNode } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { Button, ButtonLink, Card, Field, Input } from "@/components/ui";
import { conObservacion, escalaDe } from "@/lib/fichas/plantilla";
import { tituloGrupo, tituloSeccion } from "@/lib/fichas/numeracion";
import type { Plantilla, ValoresFicha } from "@/lib/fichas/tipos";
import { CampoFicha } from "./campos";

export type EstadoFicha = { error?: string; fieldErrors?: Record<string, string> };

type Accion = (prev: EstadoFicha, formData: FormData) => Promise<EstadoFicha>;

/**
 * Formulario de una ficha clínica, construido a partir de la plantilla del
 * centro. Reemplaza a los formularios que tenían cada campo escrito a mano.
 *
 * Los grupos con condición se ocultan con `hidden` en vez de desmontarse, para
 * no perder lo escrito si el usuario alterna la condición; el servidor descarta
 * lo que no corresponda (misma política que tenía la ficha de evaluación).
 */
export function FichaForm({
  plantilla,
  valores,
  fecha,
  etiquetaFecha = "Fecha",
  accion,
  cancelarHref,
  textoGuardar,
  extra,
}: {
  plantilla: Plantilla;
  valores?: ValoresFicha;
  fecha?: string;
  etiquetaFecha?: string;
  accion: Accion;
  cancelarHref: string;
  textoGuardar: string;
  /** Campos propios de la ficha que no vienen de la plantilla (ej. evaluador). */
  extra?: ReactNode;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<EstadoFicha>(accion, {});
  const registrados = valores ?? {};

  // Solo se controla en React lo que alguna condición mira; el resto son campos
  // no controlados, que es lo que permite repoblarlos tras un intento fallido.
  const [condiciones, setCondiciones] = useState<Record<string, string[]>>(() => {
    const inicial: Record<string, string[]> = {};
    for (const seccion of plantilla.secciones) {
      for (const grupo of seccion.grupos) {
        const id = grupo.visibleSi?.campoId;
        if (!id) continue;
        const v = registrados[id];
        inicial[id] = v?.t === "opciones" ? v.v : [];
      }
    }
    return inicial;
  });

  const observados = new Set(Object.keys(condiciones));

  /** Visibilidad con el estado en vivo del formulario, no con lo guardado. */
  const visible = (campoId: string | undefined, valoresCond: string[] | undefined) => {
    if (!campoId) return true;
    const elegidos = valoresCond ?? [];
    const actual = condiciones[campoId] ?? [];
    if (actual.length === 0) return true; // sin elegir todavía: se muestra
    return actual.some((v) => elegidos.includes(v));
  };

  return (
    <form key={formKey} {...formProps} className="space-y-6">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={etiquetaFecha} required>
            <Input type="date" name="fecha" defaultValue={fecha ?? ""} required />
          </Field>
          {extra}
        </div>
      </Card>

      {plantilla.secciones.map((seccion, si) => (
        <Card key={seccion.id}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {tituloSeccion(seccion.titulo, si, plantilla.numerarSecciones)}
          </h2>
          {seccion.descripcion && (
            <p className="mb-4 text-xs text-slate-500">{seccion.descripcion}</p>
          )}

          <div className="space-y-5">
            {seccion.grupos.map((grupo, gi) => (
              <div
                key={grupo.id}
                hidden={!visible(grupo.visibleSi?.campoId, grupo.visibleSi?.valores)}
              >
                {grupo.titulo && (
                  <h3 className="mb-2 text-sm font-medium text-slate-600">
                    {tituloGrupo(
                      grupo.titulo,
                      si,
                      gi,
                      plantilla.numerarSecciones,
                      seccion.numerarGrupos,
                    )}
                  </h3>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {grupo.campos.map((campo) => (
                    <CampoFicha
                      key={campo.id}
                      campo={campo}
                      valor={registrados[campo.id]}
                      escala={escalaDe(plantilla, seccion, campo)}
                      conObservacion={conObservacion(seccion, campo)}
                      onCambio={
                        observados.has(campo.id)
                          ? (v) => setCondiciones((c) => ({ ...c, [campo.id]: v }))
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <div className="flex items-center justify-end gap-3">
        <ButtonLink href={cancelarHref} variant="secondary">
          Cancelar
        </ButtonLink>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : textoGuardar}
        </Button>
      </div>
    </form>
  );
}
