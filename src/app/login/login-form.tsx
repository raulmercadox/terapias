"use client";

import { useActionState } from "react";
import { authenticate } from "./actions";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="space-y-4">
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
