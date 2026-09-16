// Fichas que congelan su plantilla (evaluación e informe de avance).
//
// La historia clínica es un expediente vivo y sigue la plantilla vigente del
// centro. La evaluación, en cambio, es un instrumento aplicado en una fecha y
// firmado por un profesional: dice "el 12/03 este paciente estaba en Proceso EN
// ESTE ENUNCIADO y EN ESTA ESCALA". Si el centro reescribe el ítem o cambia
// I/P/L por una escala de cinco niveles, releer la ficha vieja con la plantilla
// nueva cambiaría lo que el profesional afirmó. Por eso cada ficha guarda una
// copia de la estructura con la que se aplicó.

import { normalizarPlantilla } from "./plantilla";
import { normalizarValores } from "./valores";
import type { Plantilla, ValoresFicha } from "./tipos";

/** Copia independiente de la plantilla, para guardarla dentro de la ficha. */
export function snapshotDe(plantilla: Plantilla): Plantilla {
  return normalizarPlantilla(structuredClone(plantilla));
}

/** ¿La ficha se aplicó con una plantilla anterior a la vigente del centro? */
export function estaDesactualizada(
  versionFicha: number,
  versionVigente: number,
): boolean {
  return versionVigente > 0 && versionFicha > 0 && versionFicha < versionVigente;
}

/**
 * Pasa una ficha a la plantilla vigente conservando lo registrado. Los campos
 * que coinciden por id mantienen su valor; los nuevos quedan vacíos; y lo que
 * la plantilla nueva ya no tiene NO se borra: `normalizarValores` lo conserva
 * como huérfano y la vista lo muestra aparte.
 *
 * Es una decisión del profesional, nunca un efecto colateral de que alguien
 * toque Configuración.
 */
export function reconciliar(
  valores: unknown,
  vigente: Plantilla,
): { estructura: Plantilla; valores: ValoresFicha } {
  return {
    estructura: snapshotDe(vigente),
    valores: normalizarValores(valores, vigente),
  };
}
