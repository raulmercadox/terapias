"use client";

import { useFormReintento } from "@/components/form-reintento";
import { authenticate } from "./actions";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm() {
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
    <form key={formKey} {...formProps} className="space-y-4">
      <Field label="Correo" required>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="usuario@bgenius.pe"
          required
        />
      </Field>
      <Field label="Contraseña" required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
