"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ComboOption = { id: string; nombre: string };

/** Quita tildes y pasa a minúsculas para buscar sin distinción de acentos. */
function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const controlBase =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

/**
 * Selector con búsqueda. Reemplaza a un <select> largo: el usuario escribe para
 * filtrar y el valor elegido se envía en un <input hidden name={name}>, de modo
 * que los server actions que leen ese campo no cambian.
 *
 * Modo controlado: pasar `value` + `onChange`. Modo no controlado: `defaultValue`.
 */
export function Combobox({
  name,
  options,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  placeholder = "Escribe para buscar…",
  emptyText = "Sin resultados",
}: {
  name: string;
  options: ComboOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyText?: string;
}) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const selectedId = controlled ? value : internal;
  const selected = options.find((o) => o.id === selectedId) ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer clic fuera del componente.
  useEffect(() => {
    function onDocPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, []);

  const filtered = useMemo(() => {
    const q = normaliza(query);
    if (!q) return options;
    return options.filter((o) => normaliza(o.nombre).includes(q));
  }, [options, query]);

  function elegir(id: string) {
    if (!controlled) setInternal(id);
    onChange?.(id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (open && filtered[activeIdx]) {
        e.preventDefault();
        elegir(filtered[activeIdx].id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  // Mientras está abierto se muestra lo que el usuario escribe; cerrado, el nombre.
  const displayValue = open ? query : (selected?.nombre ?? "");

  return (
    <div ref={rootRef} className="relative">
      {/* Valor real enviado en el formulario. */}
      <input type="hidden" name={name} value={selectedId} />

      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        // Requerido y enfocable: bloquea el envío si no hay selección.
        required={required && !selectedId}
        value={displayValue}
        placeholder={selected ? selected.nombre : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIdx(0);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setActiveIdx(0);
        }}
        onKeyDown={onKeyDown}
        className={cn(controlBase, "bg-white pr-9", disabled && "bg-slate-100")}
      />

      {/* Botón limpiar / ícono */}
      {selected && !disabled ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => elegir("")}
          aria-label="Limpiar selección"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      ) : (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400">
          ▾
        </span>
      )}

      {open && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-400">{emptyText}</li>
          ) : (
            filtered.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  // onMouseDown (no onClick) para elegir antes del blur del input.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(o.id);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "block w-full px-3 py-2 text-left",
                    i === activeIdx ? "bg-sky-50 text-sky-700" : "text-slate-700",
                    o.id === selectedId && "font-medium",
                  )}
                >
                  {o.nombre}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
