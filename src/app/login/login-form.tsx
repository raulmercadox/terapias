"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import { authenticate } from "./actions";
import { Button, Field, Input } from "@/components/ui";

/* ── Iconos (SVG inline, sin dependencias) ─────────────── */

type IconProps = { className?: string };
const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconBuilding({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M15 21V9h3a1 1 0 0 1 1 1v11M3 21h18M8 7h2M8 11h2M8 15h2" />
    </svg>
  );
}
function IconUser({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.2 3.1-5.5 7-5.5s7 2.3 7 5.5" />
    </svg>
  );
}
function IconLock({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}
function IconEye({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEyeOff({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4M6.4 7.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.6-.3 3.7-.8" />
      <path d="M10 10a2.8 2.8 0 0 0 4 4M3.5 3.5l17 17" />
    </svg>
  );
}
function IconAlert({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16h.01" />
    </svg>
  );
}

/** Icono a la izquierda del campo; el Input compensa con padding. */
function ConIcono({
  icono,
  children,
}: {
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
        {icono}
      </span>
      {children}
    </div>
  );
}

export function LoginForm({ empresa }: { empresa?: string }) {
  const [verClave, setVerClave] = useState(false);

  // Aquí el estado es el propio mensaje de error, no un objeto con `error`.
  const {
    estado: error,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<string | undefined>(authenticate, undefined, {
    fallo: (e) => Boolean(e),
  });

  return (
    <form key={formKey} {...formProps} className="space-y-5">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <Field label="Empresa" required>
        <ConIcono icono={<IconBuilding />}>
          <Input
            name="empresa"
            autoComplete="organization"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={empresa}
            placeholder="mi-centro"
            className="pl-11"
            required
          />
        </ConIcono>
      </Field>

      <Field label="Usuario" required>
        <ConIcono icono={<IconUser />}>
          <Input
            name="usuario"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={Boolean(empresa)}
            className="pl-11"
            required
          />
        </ConIcono>
      </Field>

      <Field label="Clave" required>
        <ConIcono icono={<IconLock />}>
          <Input
            name="password"
            type={verClave ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className="pl-11 pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? "Ocultar clave" : "Mostrar clave"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-codart-500/40"
          >
            {verClave ? <IconEyeOff /> : <IconEye />}
          </button>
        </ConIcono>
      </Field>

      <Button type="submit" variant="marca" className="w-full py-2.5" disabled={pending}>
        {pending && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        )}
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
