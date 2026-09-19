import Image from "next/image";

// Logo de Codart (isotipo + palabra), marca de la plataforma. No se usa dentro del
// área del centro (tenant), donde va su propio nombre. Los SVG están en public/brand/;
// next/image no optimiza .svg, los sirve tal cual.
type Props = {
  variant?: "color" | "blanco" | "isotipo";
  className?: string;
};

const LOGO = { width: 151, height: 28 }; // proporción del viewBox del logo
const ISOTIPO = { width: 28, height: 28 };

export function CodartLogo({ variant = "color", className = "h-7 w-auto" }: Props) {
  const src =
    variant === "blanco"
      ? "/brand/codart-logo-blanco.svg"
      : variant === "isotipo"
        ? "/brand/codart-isotipo.svg"
        : "/brand/codart-logo.svg";
  const size = variant === "isotipo" ? ISOTIPO : LOGO;
  return <Image src={src} alt="Codart" {...size} className={className} />;
}
