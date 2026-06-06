"use client";

import { useTransition } from "react";
import { setActiveSede } from "@/app/(app)/actions";

type SedeOption = { id: string; nombre: string };

export function SedeSwitcher({
  sedes,
  activeSedeId,
}: {
  sedes: SedeOption[];
  activeSedeId: string;
}) {
  const [pending, startTransition] = useTransition();

  if (sedes.length <= 1) {
    return (
      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
        {sedes[0]?.nombre ?? "Sin sede"}
      </span>
    );
  }

  return (
    <select
      value={activeSedeId}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(() => setActiveSede(value));
      }}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none"
      aria-label="Sede activa"
    >
      {sedes.map((s) => (
        <option key={s.id} value={s.id}>
          {s.nombre}
        </option>
      ))}
    </select>
  );
}
