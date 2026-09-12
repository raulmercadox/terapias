"use client";

import type { ReactNode } from "react";
import { Select } from "@/components/ui";

/** Select que envía su formulario al cambiar, para filtrar sin botón. */
export function FiltroTerapeuta({
  defaultValue,
  children,
}: {
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <Select
      name="terapeutaId"
      defaultValue={defaultValue}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {children}
    </Select>
  );
}
