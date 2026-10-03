"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import type { PermisoTerapeuta, Rol } from "@prisma/client";
import { crearUsuario, actualizarUsuario, type FormState } from "../actions";
import { Button, ButtonLink, Field, Input, Select } from "@/components/ui";
import { PERMISOS_TERAPEUTA } from "@/lib/permisos";

type SedeOpcion = { id: string; nombre: string };
type TerapeutaOpcion = { id: string; nombre: string; sede: string };

type UsuarioInicial = {
  id: string;
  nombre: string;
  usuario: string;
  email: string | null;
  rol: Rol;
  activo: boolean;
  sedeIds: string[];
  terapeutaId: string | null;
  permisos: PermisoTerapeuta[];
};

export function UsuarioForm({
  sedes,
  terapeutas,
  usuario,
  esPropio = false,
}: {
  sedes: SedeOpcion[];
  /** Terapeutas que se pueden vincular: sin usuario, más el ya vinculado. */
  terapeutas: TerapeutaOpcion[];
  usuario?: UsuarioInicial;
  esPropio?: boolean;
}) {
  const editando = Boolean(usuario);
  const action = editando ? actualizarUsuario : crearUsuario;
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(action, undefined);

  const [rol, setRol] = useState<Rol>(usuario?.rol ?? "USUARIO");
  const [sedeIds, setSedeIds] = useState<string[]>(usuario?.sedeIds ?? []);

  const esAdmin = rol === "ADMINISTRADOR";
  const esUsuario = rol === "USUARIO";
  const esTerapeuta = rol === "TERAPEUTA";

  function toggleSede(id: string, checked: boolean) {
    if (esUsuario) {
      // USUARIO: exactamente una sede → comportamiento de radio.
      setSedeIds(checked ? [id] : []);
      return;
    }
    setSedeIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((s) => s !== id),
    );
  }

  return (
    <form key={formKey} {...formProps} className="space-y-5">
      {editando && <input type="hidden" name="id" value={usuario!.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" required>
          <Input name="nombre" defaultValue={usuario?.nombre} required />
        </Field>
        <Field label="Usuario" required>
          <Input
            name="usuario"
            defaultValue={usuario?.usuario}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="p. ej. maria.lopez"
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Correo electrónico">
          <Input
            name="email"
            type="email"
            defaultValue={usuario?.email ?? ""}
          />
        </Field>
        <Field label="Contraseña" required={!editando}>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={
              editando ? "Dejar en blanco para no cambiar" : "Mínimo 6 caracteres"
            }
            required={!editando}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rol" required>
          <Select
            name="rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            disabled={esPropio}
          >
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="COORDINADOR">Coordinador</option>
            <option value="USUARIO">Usuario</option>
            <option value="TERAPEUTA">Terapeuta</option>
          </Select>
          {esPropio && (
            <input type="hidden" name="rol" value={rol} />
          )}
        </Field>
      </div>

      {esTerapeuta ? (
        <>
          <Field label="Terapeuta" required>
            {terapeutas.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                No hay terapeutas activos sin usuario. Regístralo primero en
                Configuración → Terapeutas.
              </p>
            ) : (
              <Select
                name="terapeutaId"
                defaultValue={usuario?.terapeutaId ?? ""}
                required
              >
                <option value="" disabled>
                  Selecciona el terapeuta
                </option>
                {terapeutas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} · {t.sede}
                  </option>
                ))}
              </Select>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Accede a la sede del terapeuta. Ve solo su agenda y los pacientes
              que atiende, y hace sus evaluaciones e informes; no ve pagos.
            </p>
          </Field>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Permisos adicionales
            </span>
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">
                Concédelos solo a terapeutas de confianza.
              </p>
              {PERMISOS_TERAPEUTA.map((p) => (
                <label key={p.valor} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="permisos"
                    value={p.valor}
                    defaultChecked={usuario?.permisos.includes(p.valor)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>
                    <span className="block text-sm text-slate-700">
                      {p.etiqueta}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {p.descripcion}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      ) : (
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Sedes asignadas
          {!esAdmin && <span className="text-red-500"> *</span>}
        </span>
        {esAdmin ? (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700">
            Los administradores tienen acceso a todas las sedes
            automáticamente.
          </p>
        ) : sedes.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No hay sedes registradas. Crea una sede primero.
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">
              {esUsuario
                ? "El usuario debe tener exactamente una sede."
                : "El coordinador puede tener una o varias sedes."}
            </p>
            {sedes.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  name="sedeIds"
                  value={s.id}
                  checked={sedeIds.includes(s.id)}
                  onChange={(e) => toggleSede(s.id, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                {s.nombre}
              </label>
            ))}
          </div>
        )}
      </div>
      )}

      <Field label="Estado">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={usuario?.activo ?? true}
            disabled={esPropio}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          Usuario activo
        </label>
        {/* Un control deshabilitado no se envía con el formulario. Sin este
            hidden, `activo` llegaba ausente —es decir, false— y la guarda de
            autodesactivación rechazaba el guardado aunque solo se quisiera
            cambiar la clave. Mismo patrón que el <Select> de rol. El valor
            "on" es el que compara parseUsuarioForm. */}
        {esPropio && <input type="hidden" name="activo" value="on" />}
        {esPropio && (
          <p className="mt-1 text-xs text-slate-500">
            No puedes desactivar ni cambiar el rol de tu propia cuenta.
          </p>
        )}
      </Field>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <ButtonLink href="/configuracion/usuarios" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
