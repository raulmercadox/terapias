// Puente entre el formulario de una ficha y sus valores guardados. Módulo puro:
// lo usan el componente cliente (para nombrar los inputs) y la server action
// (para reconstruirlos), de modo que el nombre de cada campo se escribe UNA vez.
//
// Convención de nombres en el FormData:
//   c_<campoId>              texto, párrafo, casilla y opciones
//   t_<campoId>_<columnaId>  una entrada por fila, alineadas por índice
//   k_<itemId> / o_<itemId>  valor y observación de un ítem de checklist
//
// Los ítems de checklist llevan nombre propio por id —que es único en toda la
// plantilla— así que no hace falta el truco del hidden siempre presente que sí
// necesita el informe de avance, donde las filas se alinean por posición.

import { camposDe } from "@/lib/fichas/plantilla";
import { normalizarValores } from "@/lib/fichas/valores";
import type { Plantilla, ValoresFicha } from "@/lib/fichas/tipos";

export const nombreCampo = (campoId: string) => `c_${campoId}`;
export const nombreColumna = (campoId: string, columnaId: string) =>
  `t_${campoId}_${columnaId}`;
export const nombreItem = (itemId: string) => `k_${itemId}`;
export const nombreObs = (itemId: string) => `o_${itemId}`;

/**
 * Reconstruye los valores desde el FormData y los sanea contra la plantilla.
 *
 * Se leen TODOS los campos, incluidos los de grupos ocultos por una condición:
 * el formulario los oculta con `hidden` en vez de desmontarlos (para no perder
 * lo escrito al alternar la condición), así que siguen viajando. El descarte
 * definitivo lo hace `normalizarValores`, que conoce la regla `visibleSi`.
 */
export function parseValores(formData: FormData, plantilla: Plantilla): ValoresFicha {
  const crudo: Record<string, unknown> = {};

  for (const campo of camposDe(plantilla)) {
    switch (campo.tipo) {
      case "texto":
      case "parrafo":
        crudo[campo.id] = formData.get(nombreCampo(campo.id));
        break;

      case "casilla":
        crudo[campo.id] = formData.get(nombreCampo(campo.id)) === "on";
        break;

      case "opciones":
        crudo[campo.id] = formData.getAll(nombreCampo(campo.id)).map(String);
        break;

      case "tabla": {
        // Cada columna manda una entrada por fila; getAll las devuelve
        // alineadas por índice, igual que la vieja tabla de familiares.
        const columnas = campo.columnas.map((c) => ({
          id: c.id,
          valores: formData.getAll(nombreColumna(campo.id, c.id)).map(String),
        }));
        const filas = columnas[0]?.valores.length ?? 0;
        crudo[campo.id] = Array.from({ length: filas }, (_, i) =>
          Object.fromEntries(columnas.map((c) => [c.id, c.valores[i] ?? ""])),
        );
        break;
      }

      case "checklist": {
        const items: Record<string, { valor?: string; obs?: string }> = {};
        for (const item of campo.items) {
          items[item.id] = {
            valor: String(formData.get(nombreItem(item.id)) ?? ""),
            obs: String(formData.get(nombreObs(item.id)) ?? ""),
          };
        }
        crudo[campo.id] = items;
        break;
      }
    }
  }

  return normalizarValores(crudo, plantilla);
}
