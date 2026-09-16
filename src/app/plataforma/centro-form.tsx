"use client";

import { useFormReintento } from "@/components/form-reintento";
import { actualizarCentro, crearCentro, type FormState } from "./actions";
import { Button, ButtonLink, Field, Input } from "@/components/ui";
import { BASES, type BaseId } from "@/lib/fichas/base";

type CentroInicial = {
  id: string;
  codigo: string;
  nombre: string;
  subtitulo: string | null;
  activo: boolean;
};

/** Sin `centro`: alta (pide también sede y administrador). Con `centro`: edición. */
export function CentroForm({ centro }: { centro?: CentroInicial }) {
  const editando = Boolean(centro);
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
    hayIntento,
  } = useFormReintento<FormState>(editando ? actualizarCentro : crearCentro, undefined);

  return (
    <form key={formKey} {...formProps} className="space-y-5">
      {centro && <input type="hidden" name="id" value={centro.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del centro" required>
          <Input
            name="nombre"
            defaultValue={centro?.nombre}
            placeholder="Centro Psicopedagógico Arcoíris"
            required
          />
        </Field>
        <Field label="Código de empresa" required>
          <Input
            name="codigo"
            defaultValue={centro?.codigo}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="arcoiris"
            required
          />
        </Field>
      </div>
      <Field label="Subtítulo">
        <Input
          name="subtitulo"
          defaultValue={centro?.subtitulo ?? ""}
          placeholder="Terapias de lenguaje y aprendizaje"
        />
      </Field>

      {centro ? (
        <Field label="Estado">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="activo"
              defaultChecked={centro.activo}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            Centro activo (si se desactiva, nadie del centro puede iniciar sesión)
          </label>
        </Field>
      ) : (
        <>
          <Field label="Primera sede" required>
            <Input name="sedeNombre" defaultValue="Principal" required />
          </Field>

          <Field label="Tipo de terapia">
            <div className="space-y-2">
              {(Object.entries(BASES) as [BaseId, (typeof BASES)[BaseId]][]).map(
                ([id, b], i) => (
                  <label key={id} className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="baseFichas"
                      value={id}
                      defaultChecked={i === 0}
                      className="mt-1 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>
                      <span className="font-medium">{b.label}</span>
                      <span className="block text-xs text-slate-500">{b.descripcion}</span>
                    </span>
                  </label>
                ),
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Define las plantillas de historia clínica, evaluación e informe con las
              que arranca el centro. Se pueden editar después en Configuración.
            </p>
          </Field>
          <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">
              Administrador del centro
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nombre" required>
                <Input name="adminNombre" required />
              </Field>
              <Field label="Usuario" required>
                <Input
                  name="adminUsuario"
                  defaultValue="admin"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </Field>
              <Field label="Clave inicial" required>
                <Input
                  name="adminPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </Field>
            </div>
          </fieldset>
        </>
      )}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && !hayIntento && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.ok}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : editando ? "Guardar cambios" : "Crear centro"}
        </Button>
        <ButtonLink href="/plataforma/centros" variant="secondary">
          {editando ? "Volver" : "Cancelar"}
        </ButtonLink>
      </div>
    </form>
  );
}
