"use client";

// Dibujo a mano alzada sobre la imagen de un campo "mapa". Funciona con mouse,
// dedo y lápiz de tablet (eventos de puntero). Los trazos viajan en el
// formulario como texto Json dentro de un <textarea> oculto: a diferencia de un
// input hidden, useFormReintento sí lo repone tras un intento fallido, y este
// componente lo relee al montarse (su efecto corre después de esa reposición).

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  MAX_PUNTOS_TRAZO,
  MAX_TRAZOS,
  normalizarTrazos,
  type ColorMapa,
  type Leyenda,
  type Punto,
  type Trazo,
} from "@/lib/fichas/mapa";
import { MapaImagen } from "./mapa-vista";

/** Distancia mínima entre puntos (en fracción de la imagen): aligera el trazo. */
const PASO_MINIMO = 0.004;

export function MapaDibujo({
  nombre,
  imagenCampo,
  leyenda,
  valor,
}: {
  /** Nombre del campo en el FormData. */
  nombre: string;
  /** Imagen vigente del campo en la plantilla. */
  imagenCampo: string;
  leyenda: Leyenda;
  /** Lo ya registrado: puede estar sobre otra imagen (una anterior). */
  valor?: { imagen: string; trazos: Trazo[] };
}) {
  const [trazos, setTrazos] = useState<Trazo[]>(valor?.trazos ?? []);
  // Mientras haya trazos se dibuja sobre la imagen original; al borrar todo,
  // se pasa a la vigente del campo.
  const [imagen, setImagen] = useState(valor?.imagen ?? imagenCampo);
  const [color, setColor] = useState<ColorMapa>(leyenda[0].color);
  // El trazo en curso vive en una ref: los eventos de movimiento llegan más
  // rápido que los renders, y con estado se leería una versión vieja.
  const enCurso = useRef<Trazo | null>(null);
  const [actual, setActual] = useState<Trazo | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  const json = JSON.stringify({ imagen, trazos });

  // Tras un intento fallido el <textarea> trae lo dibujado antes del envío.
  useEffect(() => {
    const repuesto = campo.current?.value;
    if (!repuesto || repuesto === json) return;
    try {
      const v = JSON.parse(repuesto) as { imagen?: unknown; trazos?: unknown };
      setTrazos(normalizarTrazos(v.trazos));
      if (typeof v.imagen === "string") setImagen(v.imagen);
    } catch {
      // Texto ajeno: se queda lo que ya había.
    }
    // Solo al montar: después el textarea refleja el estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function punto(e: PointerEvent<SVGSVGElement>): Punto | null {
    const caja = svg.current?.getBoundingClientRect();
    if (!caja || caja.width === 0 || caja.height === 0) return null;
    return [(e.clientX - caja.left) / caja.width, (e.clientY - caja.top) / caja.height];
  }

  function empezar(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 || trazos.length >= MAX_TRAZOS) return;
    const p = punto(e);
    if (!p) return;
    try {
      // Sigue el trazo aunque el dedo salga de la imagen.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Sin captura igual se dibuja; solo se corta al salir de la imagen.
    }
    enCurso.current = { c: color, p: [p] };
    setActual(enCurso.current);
  }

  function mover(e: PointerEvent<SVGSVGElement>) {
    const t = enCurso.current;
    if (!t) return;
    const p = punto(e);
    if (!p) return;
    const [ux, uy] = t.p[t.p.length - 1];
    if (Math.hypot(p[0] - ux, p[1] - uy) < PASO_MINIMO) return;
    if (t.p.length >= MAX_PUNTOS_TRAZO) return terminar();
    enCurso.current = { ...t, p: [...t.p, p] };
    setActual(enCurso.current);
  }

  function terminar() {
    const t = enCurso.current;
    if (!t) return;
    enCurso.current = null;
    setTrazos((prev) => normalizarTrazos([...prev, t]));
    setActual(null);
  }

  const visibles = actual ? [...trazos, actual] : trazos;
  const etiquetaDe = new Map(leyenda.map((e) => [e.color, e.label]));

  return (
    <div className="space-y-2">
      <textarea ref={campo} name={nombre} value={json} readOnly hidden />

      <div className="flex flex-wrap items-center gap-2">
        {leyenda.map((e) => (
          <button
            key={e.color}
            type="button"
            onClick={() => setColor(e.color)}
            aria-pressed={color === e.color}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              color === e.color
                ? "border-slate-700 bg-slate-100 font-medium text-slate-900"
                : "border-slate-200 text-slate-600 hover:bg-slate-50",
            )}
          >
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: e.color }} />
            {e.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Button
          type="button"
          variant="secondary"
          disabled={trazos.length === 0}
          onClick={() => setTrazos(trazos.slice(0, -1))}
        >
          Deshacer
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={trazos.length === 0}
          onClick={() => {
            if (!window.confirm("¿Borrar todas las marcas?")) return;
            setTrazos([]);
            setImagen(imagenCampo);
          }}
        >
          Borrar todo
        </Button>
      </div>

      <MapaImagen
        imagen={imagen}
        trazos={visibles}
        svgRef={svg}
        className="cursor-crosshair"
        // Sin esto el dedo desplaza la página en vez de dibujar.
        style={{ touchAction: "none" }}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        role="img"
        aria-label={`Dibujo: ${trazos.length} marca(s). Color activo: ${etiquetaDe.get(color) ?? ""}`}
      />
      <p className="text-xs text-slate-400">
        Marca con el dedo, el lápiz o el mouse. Elige primero el color según lo que vas a marcar.
      </p>
    </div>
  );
}
