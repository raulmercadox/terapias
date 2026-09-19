/** Logo del centro: formatos y límite compartidos por la subida y la ruta que lo sirve. */

export const LOGO_TIPOS = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_BYTES = 450_000;

/** URL del logo versionada: cambia al subir otro, así el navegador puede cachearla. */
export function urlLogoCentro(logoActualizadoEn: Date | null): string | null {
  return logoActualizadoEn ? `/api/centro/logo?v=${logoActualizadoEn.getTime()}` : null;
}
