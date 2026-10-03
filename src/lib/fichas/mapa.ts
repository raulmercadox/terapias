// Campo "marcas sobre imagen": el dibujo del cuerpo donde se marca con lápiz la
// zona del dolor (terapia física), el mapa corporal de emociones (psicología)
// o cualquier imagen que el centro suba. Módulo puro: lo usan el saneado de
// plantillas y valores, el formulario cliente y la vista.
//
// Los trazos se guardan con coordenadas NORMALIZADAS (0 a 1 sobre el ancho y
// el alto de la imagen): el dibujo se ve igual en el celular, la tablet y la
// impresión. Cada valor guarda también la imagen sobre la que se dibujó, porque
// la historia clínica no congela su plantilla: si el centro cambia la imagen,
// las marcas antiguas siguen sobre la original.

/** Colores disponibles. La leyenda de cada campo usa algunos de ellos. */
export const PALETA = ["#dc2626", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0f172a"] as const;
export type ColorMapa = (typeof PALETA)[number];

export type Leyenda = { color: ColorMapa; label: string }[];

/** Imágenes que trae el sistema. El resto las sube cada centro. */
export const IMAGENES_BASE = {
  "base:cuerpo": { label: "Cuerpo: frente y espalda", url: "/fichas/cuerpo.svg" },
} as const;
export type ImagenBase = keyof typeof IMAGENES_BASE;

export const IMAGEN_POR_DEFECTO: ImagenBase = "base:cuerpo";

/** Imágenes que puede subir un centro (mismos formatos que el logo). */
export const IMAGEN_TIPOS = ["image/png", "image/jpeg", "image/webp"] as const;
export const IMAGEN_MAX_BYTES = 1_000_000;

/** Ids de imagen subida: los cuid que genera Prisma. */
const ID_SUBIDA = /^[a-z0-9]{20,40}$/;

export const esImagenBase = (id: string): id is ImagenBase => id in IMAGENES_BASE;

/** Id de imagen con forma válida (de fábrica o subida). No verifica dueño. */
export function esImagenValida(id: unknown): id is string {
  return typeof id === "string" && (esImagenBase(id) || ID_SUBIDA.test(id));
}

/** URL de una imagen. Las subidas pasan por una ruta que verifica el centro. */
export function urlImagen(id: string): string {
  return esImagenBase(id) ? IMAGENES_BASE[id].url : `/api/fichas/imagen/${id}`;
}

/** Leyenda de fábrica: una sola marca roja. */
export const LEYENDA_POR_DEFECTO: Leyenda = [{ color: PALETA[0], label: "Marca" }];

/** Leyenda escrita una por línea en el editor: cada línea recibe un color. */
export function leyendaDeTexto(v: string): Leyenda {
  const etiquetas = v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, PALETA.length);
  return etiquetas.length > 0
    ? etiquetas.map((label, i) => ({ color: PALETA[i], label }))
    : LEYENDA_POR_DEFECTO;
}

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object" && !Array.isArray(v);

/** Sanea la leyenda de un campo: colores de la paleta, sin repetir. */
export function normalizarLeyenda(v: unknown): Leyenda {
  if (!Array.isArray(v)) return LEYENDA_POR_DEFECTO;
  const vistos = new Set<string>();
  const out: Leyenda = [];
  for (const e of v) {
    if (!esObjeto(e)) continue;
    const color = (PALETA as readonly string[]).includes(String(e.color))
      ? (e.color as ColorMapa)
      : null;
    const label = typeof e.label === "string" ? e.label.trim() : "";
    if (!color || !label || vistos.has(color)) continue;
    vistos.add(color);
    out.push({ color, label });
  }
  return out.length > 0 ? out : LEYENDA_POR_DEFECTO;
}

/* ── Trazos ───────────────────────────────────────────── */

export type Punto = [number, number];
export type Trazo = { c: ColorMapa; p: Punto[] };

/** Límites para que un valor no crezca sin control (≈ 100 KB de Json). */
export const MAX_TRAZOS = 150;
export const MAX_PUNTOS_TRAZO = 400;
export const MAX_PUNTOS = 6000;

const redondea = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;

/**
 * Sanea una lista de trazos: coordenadas numéricas dentro de la imagen,
 * colores de la paleta y los límites de tamaño. Nunca lanza.
 */
export function normalizarTrazos(v: unknown): Trazo[] {
  if (!Array.isArray(v)) return [];
  const out: Trazo[] = [];
  let total = 0;
  for (const t of v) {
    if (out.length >= MAX_TRAZOS || total >= MAX_PUNTOS) break;
    if (!esObjeto(t) || !Array.isArray(t.p)) continue;
    const c = (PALETA as readonly string[]).includes(String(t.c)) ? (t.c as ColorMapa) : null;
    if (!c) continue;
    const p: Punto[] = [];
    for (const punto of t.p) {
      if (p.length >= MAX_PUNTOS_TRAZO || total + p.length >= MAX_PUNTOS) break;
      if (!Array.isArray(punto) || punto.length !== 2) continue;
      const [x, y] = punto;
      if (typeof x !== "number" || typeof y !== "number") continue;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      p.push([redondea(x), redondea(y)]);
    }
    if (p.length === 0) continue;
    total += p.length;
    out.push({ c, p });
  }
  return out;
}

/** "x,y x,y …" para el atributo `points` de una polilínea SVG. */
export function puntosSvg(p: Punto[]): string {
  // Un toque sin arrastre es un solo punto: se duplica para que se vea.
  const lista = p.length === 1 ? [p[0], p[0]] : p;
  return lista.map(([x, y]) => `${x},${y}`).join(" ");
}
