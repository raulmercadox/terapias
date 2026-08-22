// Gráficos del progreso, en SVG puro: sin librerías (no hay ninguna en el
// proyecto) y sin estado, así que son server components. El SVG además
// sobrevive a la impresión —el navegador descarta los fondos CSS, no las
// figuras—, que es como el centro entrega estos informes.
//
// Paleta: rampa ordinal de un solo tono (EI claro → LE oscuro, "más oscuro es
// más logro"), tomada de la escala sky de Tailwind que ya usa la app. Validada
// contra fondo blanco: tono único, pasos de luminosidad separados y el extremo
// claro por encima de 2:1 respecto del fondo.

import type { Conteo, EstadoCambio } from "./progreso";
import { VALORES_INFORME, VALOR_LABEL } from "../informes/informe";

/** sky-400 / sky-600 / sky-900. El orden es el de VALORES_INFORME. */
export const COLOR_VALOR: Record<string, string> = {
  EI: "#38bdf8",
  EP: "#0284c7",
  LE: "#0c4a6e",
};

/** Texto legible sobre cada paso de la rampa (slate-900 / blanco). */
const TEXTO_SOBRE_VALOR: Record<string, string> = {
  EI: "#0f172a",
  EP: "#ffffff",
  LE: "#ffffff",
};

const LINEA = "#0284c7"; // sky-600: la serie de logro
const GRILLA = "#e2e8f0"; // slate-200
const TEXTO_EJE = "#94a3b8"; // slate-400
const TEXTO_DATO = "#334155"; // slate-700

// Las fechas de informe son campos "solo fecha": se formatean en UTC, igual que
// `fecha()` de @/lib/utils, para que no retrocedan un día en el navegador.
const DIA_MES = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const DIA_MES_ANIO = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export type PuntoLinea = {
  fecha: Date;
  logro: number | null;
  calificados: number;
  total: number;
};

/* ── Tendencia por área ───────────────────────────────── */

const W = 260;
const H = 112;
const PAD = { top: 14, right: 24, bottom: 20, left: 28 };

function coordenadaX(i: number, n: number): number {
  const ancho = W - PAD.left - PAD.right;
  if (n <= 1) return PAD.left + ancho / 2;
  return PAD.left + (i * ancho) / (n - 1);
}

function coordenadaY(logro: number): number {
  const alto = H - PAD.top - PAD.bottom;
  return PAD.top + ((100 - logro) / 100) * alto;
}

/**
 * Los rótulos van encima del punto salvo cuando este roza el techo del área
 * de dibujo: ahí chocarían con la línea de 100 y con su etiqueta de eje, así
 * que bajan al otro lado del punto.
 */
function coordenadaYRotulo(logro: number): number {
  return logro >= 85 ? coordenadaY(logro) + 13 : coordenadaY(logro) - 9;
}

/**
 * Tendencia del logro de un área, un punto por informe.
 *
 * El eje X reparte los informes por orden, no por distancia temporal: son
 * evaluaciones periódicas y lo que se lee es la secuencia. Las fechas de los
 * extremos van rotuladas para que eso quede a la vista.
 *
 * La línea se corta en los informes sin ítems calificados en vez de saltarlos:
 * un tramo sin datos no es una recta entre dos evaluaciones.
 */
export function TendenciaArea({
  titulo,
  puntos,
}: {
  titulo: string;
  puntos: PuntoLinea[];
}) {
  const conDato = puntos
    .map((p, i) => ({ ...p, i }))
    .filter((p): p is PuntoLinea & { i: number; logro: number } =>
      p.logro !== null,
    );

  // Tramos de puntos consecutivos con dato: cada uno se dibuja por separado.
  const tramos: (typeof conDato)[] = [];
  for (const p of conDato) {
    const ultimo = tramos.at(-1);
    if (ultimo && ultimo.at(-1)!.i === p.i - 1) ultimo.push(p);
    else tramos.push([p]);
  }

  const primero = conDato.at(0);
  const ultimo = conDato.at(-1);
  // El encabezado ya muestra el valor del último informe. El rótulo sobre el
  // último punto solo se dibuja cuando ese punto NO es el último informe —es
  // decir, cuando el área dejó de evaluarse—, para no repetir la misma cifra.
  const final = puntos.at(-1);
  const ultimoEsFinal = ultimo?.i === puntos.length - 1;

  return (
    <figure className="space-y-1">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {titulo}
        </span>
        <span className="text-sm font-semibold text-slate-900">
          {final?.logro == null ? "—" : `${final.logro}%`}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Logro de ${titulo} por informe: ${
          puntos
            .map(
              (p) =>
                `${DIA_MES_ANIO.format(p.fecha)} ${p.logro === null ? "sin datos" : `${p.logro}%`}`,
            )
            .join("; ") || "sin informes"
        }`}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={coordenadaY(v)}
              y2={coordenadaY(v)}
              stroke={GRILLA}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 5}
              y={coordenadaY(v) + 3}
              textAnchor="end"
              fontSize={9}
              fill={TEXTO_EJE}
            >
              {v}
            </text>
          </g>
        ))}

        {tramos.map((tramo) => (
          <polyline
            key={tramo[0].i}
            points={tramo
              .map((p) => `${coordenadaX(p.i, puntos.length)},${coordenadaY(p.logro)}`)
              .join(" ")}
            fill="none"
            stroke={LINEA}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {conDato.map((p) => (
          <circle
            key={p.i}
            cx={coordenadaX(p.i, puntos.length)}
            cy={coordenadaY(p.logro)}
            r={4}
            fill={LINEA}
            stroke="#ffffff"
            strokeWidth={2}
          >
            <title>
              {`${DIA_MES_ANIO.format(p.fecha)}: ${p.logro}% de logro (${p.calificados} de ${p.total} ítems calificados)`}
            </title>
          </circle>
        ))}

        {/* Solo se rotulan los extremos: un número sobre cada punto satura. */}
        {primero && primero !== ultimo && (
          <text
            x={coordenadaX(primero.i, puntos.length)}
            y={coordenadaYRotulo(primero.logro)}
            textAnchor="start"
            fontSize={10}
            fontWeight={600}
            fill={TEXTO_DATO}
          >
            {primero.logro}%
          </text>
        )}
        {ultimo && !ultimoEsFinal && (
          <text
            x={coordenadaX(ultimo.i, puntos.length)}
            y={coordenadaYRotulo(ultimo.logro)}
            textAnchor="end"
            fontSize={10}
            fontWeight={600}
            fill={TEXTO_DATO}
          >
            {ultimo.logro}%
          </text>
        )}

        {puntos.length > 0 && (
          <>
            <text
              x={PAD.left}
              y={H - 5}
              textAnchor="start"
              fontSize={9}
              fill={TEXTO_EJE}
            >
              {DIA_MES.format(puntos[0].fecha)}
            </text>
            {puntos.length > 1 && (
              <text
                x={W - PAD.right}
                y={H - 5}
                textAnchor="end"
                fontSize={9}
                fill={TEXTO_EJE}
              >
                {DIA_MES.format(puntos.at(-1)!.fecha)}
              </text>
            )}
          </>
        )}
      </svg>
    </figure>
  );
}

/* ── Composición EI / EP / LE ─────────────────────────── */

const BARRA_W = 320;
const BARRA_H = 18;

/**
 * Barra apilada con el reparto de ítems entre EI, EP y LE en un informe. Se
 * apila sobre los ítems calificados: los no calificados no son una cuarta
 * categoría, se informan aparte.
 */
export function BarraComposicion({
  id,
  conteo,
  etiqueta,
}: {
  /** Identificador único de la barra: el clipPath del SVG lo necesita. */
  id: string;
  conteo: Conteo;
  etiqueta: string;
}) {
  const calificados = VALORES_INFORME.reduce((n, v) => n + conteo[v], 0);
  if (calificados === 0) {
    return (
      <p className="text-xs text-slate-400">Sin ítems calificados</p>
    );
  }

  const visibles = VALORES_INFORME.filter((v) => conteo[v] > 0);
  const anchos = visibles.map((v) => (conteo[v] / calificados) * BARRA_W);
  const segmentos = visibles.map((v, i) => ({
    valor: v,
    // El apilado empieza donde terminan los segmentos anteriores.
    x: anchos.slice(0, i).reduce((suma, w) => suma + w, 0),
    ancho: anchos[i],
    cantidad: conteo[v],
  }));

  return (
    <svg
      viewBox={`0 0 ${BARRA_W} ${BARRA_H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`${etiqueta}: ${VALORES_INFORME.map(
        (v) => `${conteo[v]} ${VALOR_LABEL[v]}`,
      ).join(", ")}`}
    >
      <clipPath id={`barra-${id}`}>
        <rect x={0} y={0} width={BARRA_W} height={BARRA_H} rx={4} />
      </clipPath>
      <g clipPath={`url(#barra-${id})`}>
        {segmentos.map((s, i) => {
          // 2px de fondo entre segmentos: el corte se ve sin necesitar borde.
          const ancho = i === segmentos.length - 1 ? s.ancho : Math.max(s.ancho - 2, 0);
          const porcentaje = Math.round((s.cantidad / calificados) * 100);
          return (
            <g key={s.valor}>
              <rect
                x={s.x}
                y={0}
                width={ancho}
                height={BARRA_H}
                fill={COLOR_VALOR[s.valor]}
              >
                <title>
                  {`${VALOR_LABEL[s.valor]}: ${s.cantidad} de ${calificados} ítems (${porcentaje}%)`}
                </title>
              </rect>
              {ancho >= 26 && (
                <text
                  x={s.x + ancho / 2}
                  y={BARRA_H / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={TEXTO_SOBRE_VALOR[s.valor]}
                  pointerEvents="none"
                >
                  {s.cantidad}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Leyenda de la rampa EI/EP/LE. Obligatoria: son tres series apiladas. */
export function LeyendaValores() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {VALORES_INFORME.map((v) => (
        <li key={v} className="flex items-center gap-1.5 text-xs text-slate-600">
          <svg width={10} height={10} aria-hidden className="shrink-0">
            <rect width={10} height={10} rx={2} fill={COLOR_VALOR[v]} />
          </svg>
          <span>
            <strong className="font-semibold">{v}</strong> · {VALOR_LABEL[v]}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ── Marca de cambio entre dos informes ───────────────── */

// El color nunca va solo: cada estado lleva su símbolo y su palabra.
const MARCA: Record<EstadoCambio, { simbolo: string; label: string; clase: string }> = {
  mejora: { simbolo: "▲", label: "Mejoró", clase: "text-green-700" },
  igual: { simbolo: "=", label: "Se mantiene", clase: "text-slate-500" },
  retroceso: { simbolo: "▼", label: "Retrocedió", clase: "text-red-700" },
  nuevo: { simbolo: "+", label: "Ítem nuevo", clase: "text-sky-700" },
  retirado: { simbolo: "−", label: "Ya no se evalúa", clase: "text-slate-400" },
  sin_dato: { simbolo: "·", label: "Sin calificar", clase: "text-slate-400" },
};

export function MarcaCambio({ estado }: { estado: EstadoCambio }) {
  const m = MARCA[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${m.clase}`}>
      <span aria-hidden>{m.simbolo}</span>
      {m.label}
    </span>
  );
}
