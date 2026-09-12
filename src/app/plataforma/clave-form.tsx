"use client";

import type { Rol } from "@prisma/client";
import { useFormReintento } from "@/components/form-reintento";
import { restablecerClave, type FormState } from "./actions";
import { Button, Field, Input, Select } from "@/components/ui";

const ROL_LABEL: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  COORDINADOR: "Coordinador",
  USUARIO: "Usuario",
};

type UsuarioOpcion = { id: string; nombre: string; usuario: string; rol: Rol };

export function ClaveForm({
  centroId,
  usuarios,
}: {
  centroId: string;
  usuarios: UsuarioOpcion[];
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
    hayIntento,
  } = useFormReintento<FormState>(restablecerClave, undefined);

  if (usuarios.length === 0) {
    return <p className="text-sm text-slate-500">El centro no tiene usuarios.</p>;
  }

  return (
    <form key={formKey} {...formProps} className="space-y-4">
      <input type="hidden" name="centroId" value={centroId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Usuario" required>
          <Select name="userId" required>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.usuario} — {u.nombre} ({ROL_LABEL[u.rol] ?? u.rol})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nueva clave" required>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            required
          />
        </Field>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && !hayIntento && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.ok}</p>
      )}

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Guardando…" : "Restablecer clave"}
      </Button>
    </form>
  );
}
