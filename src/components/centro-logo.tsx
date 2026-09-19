import { urlLogoCentro } from "@/lib/logo";

/**
 * Logo del centro (tenant), servido por /api/centro/logo. No renderiza nada si
 * el centro no subió uno. <img> y no next/image: es una ruta autenticada y
 * privada que ya llega con su propio Cache-Control.
 */
export function CentroLogo({
  logoActualizadoEn,
  className = "h-12 w-auto",
}: {
  logoActualizadoEn: Date | null;
  className?: string;
}) {
  const src = urlLogoCentro(logoActualizadoEn);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={`object-contain ${className}`} />;
}
