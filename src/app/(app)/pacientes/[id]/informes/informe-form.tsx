"use client";

import { useState, useId } from "react";
import { useFormReintento } from "@/components/form-reintento";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { FormState } from "./actions";
import {
  VALORES_INFORME,
  VALOR_LABEL,
  seccionesIniciales,
  type SeccionInforme,
  type ValorInforme,
} from "./informe";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type InformeInicial = {
  fecha?: string; // yyyy-mm-dd
  evaluadorId?: string | null;
  secciones?: SeccionInforme[];
  recomendaciones?: string | null;
};

/**
 * Una sección del informe: tabla de ítems con texto editable y las columnas
 * EI / EP / LE. Las secciones son fijas; los ítems se pueden editar, agregar
 * y quitar en cada informe.
 */
function TablaSeccion({
  seccion,
  valorEn,
}: {
  seccion: SeccionInforme;
  /** Valor del intento fallido para el ítem n de esta sección, si lo hay. */
  valorEn: (nombre: string, indice: number, original: string) => string;
}) {
  const [items, setItems] = useState(seccion.items);
  // Ids para los ítems que se agreguen aquí. No colisionan con los del
  // catálogo porque llevan prefijo propio.
  const prefijo = useId();
  const [siguiente, setSiguiente] = useState(0);

  function agregar() {
    setItems([
      ...items,
      { id: `nuevo_${prefijo}_${siguiente}`, label: "", valor: null },
    ]);
    setSiguiente(siguiente + 1);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              {/* El título de la sección ya lo pone la Card que envuelve la tabla. */}
              <th className="pb-2 pr-2">Ítem</th>
              {VALORES_INFORME.map((v) => (
                <th key={v} className="w-14 pb-2 text-center" title={VALOR_LABEL[v]}>
                  {v}
                </th>
              ))}
              <th className="w-16 pb-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="align-middle">
                <td className="py-1 pr-2">
                  <input type="hidden" name={`item_id_${seccion.id}`} value={item.id} />
                  <Input
                    name={`item_label_${seccion.id}`}
                    defaultValue={item.label}
                    aria-label={`Texto del ítem ${i + 1} de ${seccion.titulo}`}
                  />
                </td>
                <CeldasValor
                  seccionId={seccion.id}
                  itemId={item.id}
                  // CeldasValor guarda el valor en su propio estado, y al
                  // remontar el form tras un error volvería al del informe:
                  // se le devuelve lo que el usuario había marcado.
                  inicial={
                    (valorEn(
                      `item_valor_${seccion.id}`,
                      i,
                      item.valor ?? "",
                    ) as ValorInforme | "") || null
                  }
                />
                <td className="py-1 text-right">
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, j) => j !== i))}
                    className="rounded px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
                    aria-label={`Quitar ítem ${i + 1} de ${seccion.titulo}`}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-sm text-slate-500">
                  Sin ítems en esta sección.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="secondary" onClick={agregar}>
        Agregar ítem
      </Button>
    </div>
  );
}

/**
 * Las tres celdas EI/EP/LE de una fila.
 *
 * No se usa un grupo de radios nativo: un grupo sin selección no aparece en el
 * FormData, y como los ítems se alinean por índice contra item_id_*, esa
 * ausencia desplazaría los valores de las filas siguientes. En su lugar el
 * valor viaja en un hidden que siempre se envía, y los radios solo lo mueven.
 * Como efecto útil, volver a marcar la opción activa la desmarca.
 */
function CeldasValor({
  seccionId,
  itemId,
  inicial,
}: {
  seccionId: string;
  itemId: string;
  inicial: ValorInforme | null;
}) {
  const [valor, setValor] = useState<ValorInforme | "">(inicial ?? "");

  return (
    <>
      {VALORES_INFORME.map((v, i) => (
        <td key={v} className="py-1 text-center">
          {/* El hidden va dentro de la celda: como hijo directo de <tr> es HTML
              inválido y el navegador lo saca de la tabla al parsear, lo que
              rompe la hidratación. Dentro del <td> conserva su posición en el
              formulario, que es lo que alinea los valores con item_id_*. */}
          {i === 0 && (
            <input
              type="hidden"
              name={`item_valor_${seccionId}`}
              value={valor}
            />
          )}
          <input
            type="radio"
            checked={valor === v}
            onChange={() => setValor(v)}
            onClick={() => valor === v && setValor("")}
            aria-label={`${VALOR_LABEL[v]} — ${itemId}`}
            className="h-4 w-4 cursor-pointer accent-sky-600"
          />
        </td>
      ))}
    </>
  );
}

export function InformeForm({
  action,
  terapeutas,
  inicial,
  cancelarHref,
}: {
  action: Action;
  terapeutas: { id: string; nombre: string }[];
  inicial?: InformeInicial;
  cancelarHref: string;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    valorEn,
  } = useFormReintento<FormState>(action, {});
  const v = inicial ?? {};
  const secciones = v.secciones ?? seccionesIniciales();

  return (
    <form {...formProps} className="space-y-6">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de informe" required>
            <Input type="date" name="fecha" defaultValue={v.fecha ?? ""} required />
          </Field>
          <Field label="Profesional que informa">
            <Select name="evaluadorId" defaultValue={v.evaluadorId ?? ""}>
              <option value="">— Sin asignar —</option>
              {terapeutas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          EI = En Inicio · EP = En Proceso · LE = Logro Esperado. Los textos de
          cada ítem se pueden editar y solo afectan a este informe.
        </p>
      </Card>

      {secciones.map((s) => (
        <Card key={s.id}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {s.titulo}
          </h2>
          <TablaSeccion seccion={s} valorEn={valorEn} />
        </Card>
      ))}

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recomendaciones
        </h2>
        <Textarea
          name="recomendaciones"
          rows={6}
          defaultValue={v.recomendaciones ?? ""}
        />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <ButtonLink href={cancelarHref} variant="secondary">
          Cancelar
        </ButtonLink>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar informe"}
        </Button>
      </div>
    </form>
  );
}
