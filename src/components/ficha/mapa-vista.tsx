// Imagen con sus marcas, en solo lectura: la usan la vista, la impresión y, de
// fondo, el componente de dibujo. Sin hooks, así sirve en servidor y cliente.
//
// Los trazos van en un SVG superpuesto con viewBox 0..1 y sin preservar la
// proporción: las coordenadas normalizadas se estiran con la imagen, sea cual
// sea su tamaño. `vector-effect` mantiene el grosor del trazo en píxeles.

import type { ReactNode, Ref } from "react";
import { puntosSvg, urlImagen, type Leyenda, type Trazo } from "@/lib/fichas/mapa";
import { cn } from "@/lib/utils";

export const GROSOR_TRAZO = 7;

export function MapaImagen({
  imagen,
  trazos,
  className,
  svgRef,
  children,
  ...svgProps
}: {
  imagen: string;
  trazos: Trazo[];
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  children?: ReactNode;
} & Omit<React.SVGProps<SVGSVGElement>, "ref" | "children">) {
  return (
    <div className={cn("relative inline-block w-full max-w-md select-none", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por ruta propia */}
      <img
        src={urlImagen(imagen)}
        alt=""
        draggable={false}
        className="block h-auto w-full rounded-lg border border-slate-200"
      />
      <svg
        ref={svgRef}
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        {...svgProps}
      >
        {trazos.map((t, i) => (
          <polyline
            key={i}
            points={puntosSvg(t.p)}
            fill="none"
            stroke={t.c}
            strokeOpacity={0.55}
            strokeWidth={GROSOR_TRAZO}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {children}
      </svg>
    </div>
  );
}

/** Qué significa cada color. */
export function LeyendaMapa({ leyenda }: { leyenda: Leyenda }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {leyenda.map((e) => (
        <li key={e.color} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: e.color }} />
          {e.label}
        </li>
      ))}
    </ul>
  );
}
