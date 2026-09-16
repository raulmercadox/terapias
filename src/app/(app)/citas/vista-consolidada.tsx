import { cn } from "@/lib/utils";
import { aMinutos } from "../sesiones/horario";
import { DIAS_SEMANA, type Bloque, type TipoBloque } from "./helpers";

/** Alto de la grilla: 15 min ≈ 22px, suficiente para una línea de texto. */
const PX_POR_MIN = 1.5;

const BLOQUE_ESTILO: Record<TipoBloque, string> = {
  ocupado: "border-red-300 bg-red-200 text-red-900",
  libre: "border-green-300 bg-green-100 text-green-900",
  refrigerio: "border-slate-200 bg-slate-100 text-slate-500",
};

const BLOQUE_LABEL: Record<TipoBloque, string> = {
  ocupado: "Ocupado",
  libre: "Libre",
  refrigerio: "Refrigerio",
};

export type ColumnaDia = {
  key: string;
  fecha: string;
  esHoy: boolean;
  bloques: Bloque[];
  /** Por qué no hay horario libre ese día ("No laborable", "Feriado"). */
  nota?: string;
};

function duracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Semana de un terapeuta en bloques continuos sobre una línea de tiempo. */
export function VistaConsolidada({ columnas }: { columnas: ColumnaDia[] }) {
  const todos = columnas.flatMap((c) => c.bloques);
  if (todos.length === 0) return null;

  // Rango visible: de la primera a la última hora con algo, en horas enteras.
  const desde = Math.floor(Math.min(...todos.map((b) => aMinutos(b.inicio))) / 60) * 60;
  const hasta = Math.ceil(Math.max(...todos.map((b) => aMinutos(b.fin))) / 60) * 60;
  const alto = (hasta - desde) * PX_POR_MIN;
  const horas = Array.from(
    { length: (hasta - desde) / 60 + 1 },
    (_, i) => desde + i * 60,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        {(Object.keys(BLOQUE_ESTILO) as TipoBloque[])
          .filter((t) => t !== "refrigerio" || todos.some((b) => b.tipo === t))
          .map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-sm border", BLOQUE_ESTILO[t])} />
            {BLOQUE_LABEL[t]}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          className="grid min-w-[760px]"
          style={{ gridTemplateColumns: "3.5rem repeat(7, minmax(0, 1fr))" }}
        >
          <div className="border-b border-slate-200" />
          {columnas.map((c, i) => {
            const libre = c.bloques
              .filter((b) => b.tipo === "libre")
              .reduce((s, b) => s + aMinutos(b.fin) - aMinutos(b.inicio), 0);
            return (
              <div
                key={c.key}
                className={cn(
                  "border-b border-l border-slate-200 px-2 py-2 text-center",
                  c.esHoy && "bg-sky-50",
                )}
              >
                <div className="text-sm font-semibold text-slate-900">
                  {DIAS_SEMANA[i]}
                </div>
                <div className="text-xs text-slate-500">{c.fecha}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {c.nota ?? `Libre: ${libre > 0 ? duracion(libre) : "—"}`}
                </div>
              </div>
            );
          })}

          <div className="relative" style={{ height: alto }}>
            {horas.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-xs text-slate-400 first:translate-y-0 last:-translate-y-full"
                style={{ top: (h - desde) * PX_POR_MIN }}
              >
                {String(h / 60).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {columnas.map((c) => (
            <div
              key={c.key}
              className={cn(
                "relative border-l border-slate-200",
                c.nota && "bg-slate-50",
                c.esHoy && "bg-sky-50/50",
              )}
              style={{ height: alto }}
            >
              {horas.slice(1, -1).map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-dashed border-slate-100"
                  style={{ top: (h - desde) * PX_POR_MIN }}
                />
              ))}
              {c.bloques.map((b) => {
                const ini = aMinutos(b.inicio);
                const min = aMinutos(b.fin) - ini;
                const detalle =
                  b.tipo === "ocupado"
                    ? ` · ${b.citas} cita${b.citas === 1 ? "" : "s"}`
                    : "";
                return (
                  <div
                    key={`${b.tipo}-${b.inicio}`}
                    title={`${BLOQUE_LABEL[b.tipo]} ${b.inicio}–${b.fin} (${duracion(min)})${detalle}`}
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-md border px-1.5 text-xs leading-5",
                      BLOQUE_ESTILO[b.tipo],
                    )}
                    style={{
                      top: (ini - desde) * PX_POR_MIN,
                      height: min * PX_POR_MIN,
                    }}
                  >
                    {min >= 15 && (
                      <span className="font-medium">
                        {b.inicio}–{b.fin}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
