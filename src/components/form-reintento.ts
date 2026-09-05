"use client";

import { useActionState, useCallback, useState } from "react";

/**
 * React resetea los campos no controlados de un `<form action={...}>` cuando la
 * acción termina, también si terminó en error: lo que el usuario acababa de
 * escribir se pierde y hay que volver a llenar todo el formulario.
 *
 * Este hook envuelve `useActionState` y, cuando la acción devuelve un error,
 * guarda lo enviado y remonta el `<form>` (cambia su `key`) repoblando los
 * campos desde ese borrador. Al remontar, el reset que React pidió sobre el
 * form anterior ya no aplica, así que no hay carrera entre ambos.
 */

/** Valores enviados, por nombre de campo (getAll: cubre checkboxes y selects múltiples). */
type Borrador = Record<string, string[]>;

function instantanea(formData: FormData): Borrador {
  const out: Borrador = {};
  for (const [nombre, valor] of formData.entries()) {
    if (typeof valor !== "string") continue;
    (out[nombre] ??= []).push(valor);
  }
  return out;
}

/** Vuelve a poner el borrador en los campos del form recién montado. */
function restaurar(form: HTMLFormElement, borrador: Borrador) {
  // Las tablas dinámicas repiten el mismo `name` en cada fila (fam_nombres…),
  // así que los valores se consumen por posición: el n-ésimo campo con ese
  // nombre recibe el n-ésimo valor enviado, no siempre el primero.
  const consumidos = new Map<string, number>();

  for (const el of Array.from(form.elements)) {
    const campo =
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
        ? el
        : null;
    if (!campo || !campo.name) continue;

    const valores = borrador[campo.name];

    // Un checkbox/radio ausente del borrador es uno que quedó desmarcado.
    // No consumen posición: varios comparten nombre a propósito (un grupo).
    if (
      campo instanceof HTMLInputElement &&
      (campo.type === "checkbox" || campo.type === "radio")
    ) {
      campo.checked = valores?.includes(campo.value) ?? false;
      continue;
    }

    const posicion = consumidos.get(campo.name) ?? 0;
    consumidos.set(campo.name, posicion + 1);

    // Los hidden los escribe React (Combobox) y los file no se pueden repoblar.
    // La contraseña se deja en blanco a propósito: no se reinyecta una
    // credencial en el DOM tras un intento fallido. Aun así consumen posición,
    // para no descuadrar a otro campo que comparta el nombre.
    if (
      campo instanceof HTMLInputElement &&
      (campo.type === "hidden" ||
        campo.type === "file" ||
        campo.type === "password")
    ) {
      continue;
    }

    if (!valores) continue;

    if (campo instanceof HTMLSelectElement && campo.multiple) {
      for (const opcion of Array.from(campo.options)) {
        opcion.selected = valores.includes(opcion.value);
      }
    } else {
      campo.value = valores[posicion] ?? "";
    }
  }
}

/** Hubo error si el estado devuelto trae `error` o `fieldErrors`. */
function conError(estado: unknown): boolean {
  if (!estado || typeof estado !== "object") return false;
  const s = estado as { error?: unknown; fieldErrors?: unknown };
  return Boolean(s.error) || Boolean(s.fieldErrors);
}

export function useFormReintento<S>(
  accion: (previo: S, formData: FormData) => Promise<S> | S,
  inicial: S,
  opciones: {
    /** Detección de error cuando el estado no usa `error`/`fieldErrors`. */
    fallo?: (estado: S) => boolean;
    /** Se ejecuta cuando la acción termina sin error (p. ej. cerrar un panel). */
    alExito?: () => void;
  } = {},
) {
  const { fallo = conError, alExito } = opciones;
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [intento, setIntento] = useState(0);

  // useActionState tipa el estado como Awaited<S>, que TypeScript no reduce a S
  // sobre un genérico. Los estados de acción del proyecto son objetos planos
  // (nunca promesas), así que se cruza la frontera como unknown y se recupera S.
  const [estado, enviar, pendiente] = useActionState(
    async (previo: unknown, formData: FormData): Promise<unknown> => {
      const siguiente = await accion(previo as S, formData);
      if (fallo(siguiente)) {
        setBorrador(instantanea(formData));
        setIntento((n) => n + 1);
      } else {
        setBorrador(null);
        alExito?.();
      }
      return siguiente;
    },
    inicial as unknown,
  );

  // Corre al montar el form; la key cambia en cada intento fallido.
  const ref = useCallback(
    (form: HTMLFormElement | null) => {
      if (form && borrador) restaurar(form, borrador);
    },
    [borrador],
  );

  return {
    estado: estado as S,
    pendiente,
    /** Props del `<form>`: acción, remonte por intento y repoblado de campos. */
    formProps: { action: enviar, key: intento, ref },
    /**
     * Hay un intento fallido en curso. El estado de la acción conserva su
     * `error` para siempre, así que sirve para no mostrar uno ya resuelto.
     */
    hayIntento: borrador !== null,
    /** Descarta el borrador (p. ej. al reabrir el formulario desde cero). */
    limpiar: () => setBorrador(null),
    /**
     * Valor a usar como `defaultValue` de un campo cuyo estado no vive en el
     * DOM (p. ej. `Combobox`, que se reinicia al remontar el form).
     */
    valor: (nombre: string, original: string) =>
      borrador?.[nombre]?.[0] ?? original,
    /** Igual que `valor`, para el n-ésimo campo que repite ese nombre. */
    valorEn: (nombre: string, indice: number, original: string) =>
      borrador?.[nombre]?.[indice] ?? original,
  };
}
