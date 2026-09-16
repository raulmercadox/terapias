"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { Button, ButtonLink, Card, Input } from "@/components/ui";
import {
  guardarPlantilla,
  restaurarPlantillaBase,
  type FormState,
} from "../../actions";
import { NOMBRES } from "@/lib/fichas/editor";
import { BASES, type BaseId } from "@/lib/fichas/base";
import { tituloSeccion } from "@/lib/fichas/numeracion";
import type { Campo, Plantilla, TipoFicha } from "@/lib/fichas/tipos";

const TIPO_CAMPO_LABEL: Record<Campo["tipo"], string> = {
  texto: "Texto corto",
  parrafo: "Texto largo",
  casilla: "Casilla",
  opciones: "Opciones",
  tabla: "Tabla",
  checklist: "Lista evaluable",
};

/** Ítems de un checklist: se pueden renombrar, agregar y quitar. */
function ItemsDelCampo({
  campoId,
  items,
}: {
  campoId: string;
  items: { id: string; label: string }[];
}) {
  const [filas, setFilas] = useState(items);

  return (
    <div className="mt-2 space-y-2">
      {filas.map((item, i) => (
        <div key={item.id || `nuevo-${i}`} className="flex items-center gap-2">
          <input type="hidden" name={NOMBRES.itemCampo} value={campoId} />
          <input type="hidden" name={NOMBRES.itemId} value={item.id} />
          <Input
            name={NOMBRES.itemLabel}
            defaultValue={item.label}
            aria-label={`Ítem ${i + 1}`}
            className="py-1.5"
          />
          <button
            type="button"
            onClick={() => setFilas(filas.filter((_, j) => j !== i))}
            className="shrink-0 rounded px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
            aria-label={`Quitar ítem ${i + 1}`}
          >
            Quitar
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => setFilas([...filas, { id: "", label: "" }])}
      >
        Agregar ítem
      </Button>
    </div>
  );
}

export function PlantillaForm({
  tipo,
  plantilla,
}: {
  tipo: TipoFicha;
  plantilla: Plantilla;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(guardarPlantilla, undefined);

  return (
    <div className="space-y-6">
      <form key={formKey} {...formProps} className="space-y-6">
        <input type="hidden" name="tipo" value={tipo} />

        {state?.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        {plantilla.secciones.map((seccion, si) => (
          <Card key={seccion.id}>
            <input type="hidden" name={NOMBRES.seccionId} value={seccion.id} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Sección {plantilla.numerarSecciones ? tituloSeccion("", si, true).trim() : si + 1}
              </span>
              <Input
                name={NOMBRES.seccionTitulo}
                defaultValue={seccion.titulo}
                aria-label={`Título de la sección ${si + 1}`}
                className="font-medium"
              />
            </label>

            <div className="mt-4 space-y-4">
              {seccion.grupos.map((grupo) => (
                <div key={grupo.id} className="rounded-lg border border-slate-200 p-3">
                  {grupo.titulo && (
                    <p className="mb-2 text-sm font-medium text-slate-600">
                      {grupo.titulo}
                    </p>
                  )}
                  {grupo.visibleSi && (
                    <p className="mb-2 text-xs text-slate-400">
                      Se muestra solo si «{grupo.visibleSi.campoId}» es{" "}
                      {grupo.visibleSi.valores.join(" o ")}.
                    </p>
                  )}

                  <div className="space-y-3">
                    {grupo.campos.map((campo) => (
                      <div key={campo.id}>
                        <div className="flex items-center gap-2">
                          <input type="hidden" name={NOMBRES.campoId} value={campo.id} />
                          <Input
                            name={NOMBRES.campoLabel}
                            defaultValue={campo.label ?? ""}
                            placeholder={
                              campo.tipo === "checklist" ? "(lista sin título)" : ""
                            }
                            aria-label={`Texto del campo ${campo.id}`}
                            className="py-1.5"
                          />
                          <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">
                            {TIPO_CAMPO_LABEL[campo.tipo]}
                          </span>
                        </div>
                        {campo.tipo === "checklist" && (
                          <ItemsDelCampo campoId={campo.id} items={campo.items} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}

        <div className="flex items-center justify-end gap-3">
          <ButtonLink href="/configuracion/fichas" variant="secondary">
            Cancelar
          </ButtonLink>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar plantilla"}
          </Button>
        </div>
      </form>

      <Card className="border-amber-200 bg-amber-50">
        <h2 className="text-sm font-semibold text-amber-900">Restaurar plantilla base</h2>
        <p className="mt-1 text-xs text-amber-800">
          Reemplaza esta plantilla por la prearmada del rubro elegido. Se descarta lo
          que hayas editado; las fichas ya registradas no cambian.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(BASES) as BaseId[]).map((id) => (
            <RestaurarForm key={id} tipo={tipo} base={id} label={BASES[id].label} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function RestaurarForm({
  tipo,
  base,
  label,
}: {
  tipo: TipoFicha;
  base: BaseId;
  label: string;
}) {
  const { pendiente, formProps, formKey } = useFormReintento<FormState>(
    restaurarPlantillaBase,
    undefined,
  );

  return (
    <form key={formKey} {...formProps}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="base" value={base} />
      <Button type="submit" variant="secondary" disabled={pendiente}>
        {pendiente ? "Restaurando…" : label}
      </Button>
    </form>
  );
}
