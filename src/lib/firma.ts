/**
 * Validación de la firma dibujada (PNG como data URL). Función pura, sin
 * dependencias de servidor, para poder probarla.
 */

const PREFIJO = "data:image/png;base64,";
/** Tope del data URL completo. Una firma recortada pesa ~10–40 KB. */
export const FIRMA_MAX_CARACTERES = 300_000;
/** Tope de cada lado de la imagen, en píxeles. */
const FIRMA_MAX_LADO = 2000;

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type ResultadoFirma =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

export function validarFirmaPng(valor: string): ResultadoFirma {
  const dataUrl = valor.trim();
  if (!dataUrl) return { ok: false, error: "Dibuja tu firma antes de guardar." };
  if (!dataUrl.startsWith(PREFIJO)) {
    return { ok: false, error: "La firma no tiene un formato válido." };
  }
  if (dataUrl.length > FIRMA_MAX_CARACTERES) {
    return { ok: false, error: "La firma es demasiado grande." };
  }

  const base64 = dataUrl.slice(PREFIJO.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return { ok: false, error: "La firma no tiene un formato válido." };
  }
  const bytes = Buffer.from(base64, "base64");

  // Firma PNG (8 bytes) + bloque IHDR, que trae el ancho y el alto.
  const esPng =
    bytes.length > 24 &&
    FIRMA_PNG.every((b, i) => bytes[i] === b) &&
    bytes.toString("ascii", 12, 16) === "IHDR";
  if (!esPng) return { ok: false, error: "La firma no es una imagen PNG." };

  const ancho = bytes.readUInt32BE(16);
  const alto = bytes.readUInt32BE(20);
  if (ancho < 1 || alto < 1 || ancho > FIRMA_MAX_LADO || alto > FIRMA_MAX_LADO) {
    return { ok: false, error: "La firma tiene un tamaño de imagen inválido." };
  }

  return { ok: true, dataUrl };
}
