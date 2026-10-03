"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Recuadro para dibujar la firma con el dedo, un lápiz digital o el mouse.
 * Usa Pointer Events, que tratan los tres por igual. Los trazos se guardan
 * como puntos (en px CSS) para poder redibujar al cambiar el tamaño y para
 * deshacer. El PNG que se envía se genera aparte: recortado al área firmada,
 * con fondo transparente y a un tamaño acotado (ver `exportarPng`).
 *
 * Escribe el data URL en un `<input type="hidden" name={name}>`; vacío
 * mientras no haya trazos.
 */

type Punto = { x: number; y: number; grosor: number };
type Trazo = Punto[];

const ALTO_CSS = 200;
const COLOR = "#0f172a";
const GROSOR_BASE = 2.5;
/** Tamaño máximo del PNG exportado. */
const MAX_ANCHO = 600;
const MAX_ALTO = 200;
const MARGEN = 8;

/** El lápiz reporta presión (0–1); el dedo y el mouse, un valor fijo. */
function grosorDe(e: PointerEvent | React.PointerEvent): number {
  if (e.pointerType === "pen" && e.pressure > 0) return 1 + e.pressure * 3;
  return GROSOR_BASE;
}

/** Dibuja un trazo suavizado (curvas por los puntos medios). */
function dibujarTrazo(ctx: CanvasRenderingContext2D, trazo: Trazo) {
  if (trazo.length === 0) return;
  ctx.strokeStyle = COLOR;
  ctx.fillStyle = COLOR;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (trazo.length === 1) {
    const p = trazo[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.grosor / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  for (let i = 1; i < trazo.length; i++) {
    const a = trazo[i - 1];
    const b = trazo[i];
    const anterior = i > 1 ? trazo[i - 2] : a;
    ctx.lineWidth = (a.grosor + b.grosor) / 2;
    ctx.beginPath();
    ctx.moveTo((anterior.x + a.x) / 2, (anterior.y + a.y) / 2);
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.stroke();
  }

  // Las curvas acaban en el punto medio del último tramo: se completa hasta
  // el punto final para que el trazo no quede corto.
  const penultimo = trazo[trazo.length - 2];
  const ultimo = trazo[trazo.length - 1];
  ctx.lineWidth = ultimo.grosor;
  ctx.beginPath();
  ctx.moveTo((penultimo.x + ultimo.x) / 2, (penultimo.y + ultimo.y) / 2);
  ctx.lineTo(ultimo.x, ultimo.y);
  ctx.stroke();
}

/** PNG recortado al área firmada, con fondo transparente. */
function exportarPng(trazos: Trazo[]): string {
  const puntos = trazos.flat();
  if (puntos.length === 0) return "";

  const minX = Math.min(...puntos.map((p) => p.x)) - MARGEN;
  const minY = Math.min(...puntos.map((p) => p.y)) - MARGEN;
  const maxX = Math.max(...puntos.map((p) => p.x)) + MARGEN;
  const maxY = Math.max(...puntos.map((p) => p.y)) + MARGEN;
  const ancho = maxX - minX;
  const alto = maxY - minY;

  // Escala para que entre en MAX_ANCHO × MAX_ALTO; se permite agrandar hasta
  // 2× para que una firma pequeña no quede pixelada al imprimir.
  const escala = Math.min(MAX_ANCHO / ancho, MAX_ALTO / alto, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(ancho * escala));
  canvas.height = Math.max(1, Math.round(alto * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.setTransform(escala, 0, 0, escala, -minX * escala, -minY * escala);
  for (const t of trazos) dibujarTrazo(ctx, t);
  return canvas.toDataURL("image/png");
}

export function FirmaPad({
  name,
  onCambio,
}: {
  name: string;
  /** Avisa si hay o no algo dibujado (p. ej. para habilitar "Guardar"). */
  onCambio?: (hayFirma: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trazosRef = useRef<Trazo[]>([]);
  const actualRef = useRef<Trazo | null>(null);
  const [valor, setValor] = useState("");
  const [cantidad, setCantidad] = useState(0);

  const redibujar = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const t of trazosRef.current) dibujarTrazo(ctx, t);
    if (actualRef.current) dibujarTrazo(ctx, actualRef.current);
  }, []);

  // Ajusta la resolución del canvas a su tamaño real (y al girar la tableta).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ajustar = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(ALTO_CSS * dpr);
      redibujar();
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redibujar]);

  const actualizarValor = useCallback(() => {
    const png = exportarPng(trazosRef.current);
    setValor(png);
    setCantidad(trazosRef.current.length);
    onCambio?.(png !== "");
  }, [onCambio]);

  function punto(e: PointerEvent | React.PointerEvent): Punto {
    const r = canvasRef.current!.getBoundingClientRect();
    // Con la captura el trazo sigue fuera del recuadro: se limita a sus bordes
    // para que el PNG no lleve partes que no se ven en pantalla.
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    const y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
    return { x, y, grosor: grosorDe(e) };
  }

  function alPresionar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    actualRef.current = [punto(e)];
    redibujar();
    // La captura mantiene el trazo aunque el dedo salga del recuadro; si el
    // navegador no la permite, se dibuja igual.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  }

  function alMover(e: React.PointerEvent<HTMLCanvasElement>) {
    const trazo = actualRef.current;
    if (!trazo) return;
    e.preventDefault();
    // Los eventos agrupados dan un trazo más fino con lápiz y en tabletas.
    // Algunos navegadores devuelven la lista vacía: entonces vale el propio evento.
    const agrupados = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const eventos = agrupados.length > 0 ? agrupados : [e.nativeEvent];
    for (const ev of eventos) trazo.push(punto(ev));
    redibujar();
  }

  function alSoltar() {
    const trazo = actualRef.current;
    if (!trazo) return;
    actualRef.current = null;
    trazosRef.current = [...trazosRef.current, trazo];
    redibujar();
    actualizarValor();
  }

  function limpiar() {
    trazosRef.current = [];
    actualRef.current = null;
    redibujar();
    actualizarValor();
  }

  function deshacer() {
    trazosRef.current = trazosRef.current.slice(0, -1);
    redibujar();
    actualizarValor();
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          style={{ height: ALTO_CSS, touchAction: "none" }}
          className="block w-full cursor-crosshair select-none"
          onPointerDown={alPresionar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          aria-label="Recuadro para dibujar la firma"
        />
        {/* Línea guía: solo visual, no sale en el PNG. */}
        <div className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-slate-300" />
        {cantidad === 0 && (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-xs text-slate-400">
            Firma aquí con el dedo, el lápiz o el mouse
          </p>
        )}
      </div>
      <input type="hidden" name={name} value={valor} />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={deshacer}
          disabled={cantidad === 0}
        >
          Deshacer trazo
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={limpiar}
          disabled={cantidad === 0}
        >
          Limpiar
        </Button>
      </div>
    </div>
  );
}
