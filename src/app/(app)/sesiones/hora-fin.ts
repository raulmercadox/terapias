import { sumarMinutos } from "./horario";

/**
 * En un formulario con `horaInicio` y `horaFin`, llena la hora de fin con el
 * inicio + la duración de sesión de la terapia. Sin duración (sesiones sin
 * terapia) o si pasaría de medianoche, deja la hora de fin como está.
 */
export function ajustarHoraFin(form: HTMLFormElement | null, duracionMin?: number) {
  if (!form || !duracionMin) return;
  const campo = (n: string) => form.elements.namedItem(n) as HTMLInputElement | null;
  const inicio = campo("horaInicio")?.value;
  const fin = campo("horaFin");
  if (!inicio || !fin) return;
  const calculada = sumarMinutos(inicio, duracionMin);
  if (calculada > inicio) fin.value = calculada;
}
