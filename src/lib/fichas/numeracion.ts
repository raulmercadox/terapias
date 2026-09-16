// Numeración del formato impreso ("I.", "II.1", "V."). Antes iba escrita a mano
// dentro del título de cada sección del catálogo; ahora que el centro puede
// agregar, quitar y reordenar secciones, se calcula por posición para que la
// numeración nunca quede desfasada respecto de lo que se ve.

const ROMANOS: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** 1 → "I", 4 → "IV", 14 → "XIV". Fuera de rango devuelve el número tal cual. */
export function romano(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  let resto = n;
  let out = "";
  for (const [valor, letra] of ROMANOS) {
    while (resto >= valor) {
      out += letra;
      resto -= valor;
    }
  }
  return out;
}

/** "I. Datos generales" (o el título pelado si la plantilla no numera). */
export function tituloSeccion(
  titulo: string,
  indice: number,
  numerar: boolean | undefined,
): string {
  return numerar ? `${romano(indice + 1)}. ${titulo}` : titulo;
}

/** "II.1 Historia familiar" (o el título pelado si la sección no numera grupos). */
export function tituloGrupo(
  titulo: string,
  indiceSeccion: number,
  indiceGrupo: number,
  numerarSecciones: boolean | undefined,
  numerarGrupos: boolean | undefined,
): string {
  if (!numerarGrupos) return titulo;
  const prefijo = numerarSecciones
    ? `${romano(indiceSeccion + 1)}.${indiceGrupo + 1}`
    : `${indiceGrupo + 1}.`;
  return `${prefijo} ${titulo}`;
}
