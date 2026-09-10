"use client";

import { useState } from "react";
import { useFormReintento } from "@/components/form-reintento";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { FormState } from "./actions";
import {
  AREAS_FICHA,
  IPL_LABEL,
  MODALIDAD_LABEL,
  grupoAplica,
  type Resultados,
} from "./ficha";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type TerapeutaOpcion = { id: string; nombre: string };

export type EvaluacionInicial = {
  fecha?: string; // yyyy-mm-dd
  evaluadorId?: string | null;
  lugarNacimiento?: string | null;
  numeroHermanos?: string | null;
  nivelAcademico?: string | null;
  centroEducativo?: string | null;
  conviveMadre?: boolean;
  convivePadre?: boolean;
  conviveHermanos?: boolean;
  conviveOtros?: string | null;
  relacionDetalle?: string | null;
  diagnostico?: string | null;
  medicacion?: string | null;
  terapiasRealiza?: string | null;
  dificultadesDormir?: string | null;
  dificultadesComer?: string | null;
  dificultadesPresenta?: string | null;
  preescolar?: string | null;
  escolar?: string | null;
  comportamientoAula?: string | null;
  rendimientoEscolar?: string | null;
  dificultadesEscolares?: string | null;
  resultados?: Resultados;
  modalidadLenguaje?: string | null;
  observacionSensorial?: string | null;
  observacionMotriz?: string | null;
  observacionGeneral?: string | null;
  programaRecomendado?: string | null;
  recomendaciones?: string | null;
};

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {titulo}
      </h2>
      {children}
    </Card>
  );
}

/** Radios de un ítem de checklist: "—" (sin evaluar) + valores del área. */
function RadiosItem({
  itemId,
  valores,
  actual,
}: {
  itemId: string;
  valores: readonly string[];
  actual?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-1 text-xs text-slate-400">
        <input
          type="radio"
          name={`res_${itemId}`}
          value=""
          defaultChecked={!actual}
        />
        —
      </label>
      {valores.map((v) => (
        <label
          key={v}
          className="flex items-center gap-1 text-sm text-slate-700"
        >
          <input
            type="radio"
            name={`res_${itemId}`}
            value={v}
            defaultChecked={actual === v}
          />
          {v === "SI" ? "Sí" : v === "NO" ? "No" : v}
        </label>
      ))}
    </div>
  );
}

export function EvaluacionForm({
  action,
  terapeutas,
  inicial,
  cancelarHref,
}: {
  action: Action;
  terapeutas: TerapeutaOpcion[];
  inicial?: EvaluacionInicial;
  cancelarHref: string;
}) {
  const {
    estado: state,
    pendiente: pending,
    formProps,
    formKey,
  } = useFormReintento<FormState>(action, {});
  const v = inicial ?? {};
  const res = v.resultados ?? {};
  // Controlada porque de ella depende qué grupos del área de lenguaje se ven.
  const [modalidad, setModalidad] = useState(v.modalidadLenguaje ?? "");

  return (
    <form key={formKey} {...formProps} className="space-y-6">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <Seccion titulo="Datos de la evaluación">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de evaluación" required>
            <Input type="date" name="fecha" defaultValue={v.fecha ?? ""} required />
          </Field>
          <Field label="Evaluador(a)">
            <Select name="evaluadorId" defaultValue={v.evaluadorId ?? ""}>
              <option value="">— Seleccione —</option>
              {terapeutas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="I. Datos personales complementarios">
        <p className="mb-4 text-xs text-slate-500">
          Los datos básicos (nombres, edad, sexo, dirección, teléfono) se toman
          de la ficha del paciente.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lugar de nacimiento">
            <Input name="lugarNacimiento" defaultValue={v.lugarNacimiento ?? ""} />
          </Field>
          <Field label="N° de hermanos">
            <Input name="numeroHermanos" defaultValue={v.numeroHermanos ?? ""} />
          </Field>
          <Field label="Nivel académico">
            <Input name="nivelAcademico" defaultValue={v.nivelAcademico ?? ""} />
          </Field>
          <Field label="Centro educativo">
            <Input name="centroEducativo" defaultValue={v.centroEducativo ?? ""} />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="II. Relación del menor con las personas que convive">
        <div className="mb-4 flex flex-wrap items-center gap-5">
          {(
            [
              ["conviveMadre", "Madre", v.conviveMadre],
              ["convivePadre", "Padre", v.convivePadre],
              ["conviveHermanos", "Hermanos", v.conviveHermanos],
            ] as const
          ).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name={name} defaultChecked={checked ?? false} />
              {label}
            </label>
          ))}
          <div className="flex items-center gap-2 text-sm text-slate-700">
            Otros:
            <Input
              name="conviveOtros"
              defaultValue={v.conviveOtros ?? ""}
              className="w-48"
            />
          </div>
        </div>
        <Field label="Detalle de la relación">
          <Textarea name="relacionDetalle" defaultValue={v.relacionDetalle ?? ""} />
        </Field>
      </Seccion>

      <Seccion titulo="III. Historia personal">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Evaluación (Dx)">
            <Input name="diagnostico" defaultValue={v.diagnostico ?? ""} />
          </Field>
          <Field label="Medicación (dosis)">
            <Input name="medicacion" defaultValue={v.medicacion ?? ""} />
          </Field>
          <Field label="Terapias que realiza">
            <Input name="terapiasRealiza" defaultValue={v.terapiasRealiza ?? ""} />
          </Field>
          <Field label="Dificultades para dormir">
            <Input name="dificultadesDormir" defaultValue={v.dificultadesDormir ?? ""} />
          </Field>
          <Field label="Dificultades en la alimentación">
            <Input name="dificultadesComer" defaultValue={v.dificultadesComer ?? ""} />
          </Field>
          <Field label="Dificultades que presenta">
            <Input
              name="dificultadesPresenta"
              defaultValue={v.dificultadesPresenta ?? ""}
            />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="IV. Antecedentes escolares">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preescolar">
            <Input name="preescolar" defaultValue={v.preescolar ?? ""} />
          </Field>
          <Field label="Escolar">
            <Input name="escolar" defaultValue={v.escolar ?? ""} />
          </Field>
          <Field label="Comportamiento en el aula">
            <Input
              name="comportamientoAula"
              defaultValue={v.comportamientoAula ?? ""}
            />
          </Field>
          <Field label="Rendimiento escolar">
            <Input
              name="rendimientoEscolar"
              defaultValue={v.rendimientoEscolar ?? ""}
            />
          </Field>
          <Field label="Dificultades que presenta" className="sm:col-span-2">
            <Input
              name="dificultadesEscolares"
              defaultValue={v.dificultadesEscolares ?? ""}
            />
          </Field>
        </div>
      </Seccion>

      {AREAS_FICHA.map((area) => (
        <Seccion key={area.id} titulo={area.titulo}>
          {area.tipo === "IPL" && (
            <p className="mb-3 text-xs text-slate-500">
              Indicadores: I = {IPL_LABEL.I}, P = {IPL_LABEL.P}, L ={" "}
              {IPL_LABEL.L}.
            </p>
          )}
          {area.id === "lenguaje" && (
            <div className="mb-4 flex items-center gap-5 text-sm text-slate-700">
              <span className="font-medium">Modalidad:</span>
              {(
                [
                  ["", "—"],
                  ["VERBAL", MODALIDAD_LABEL.VERBAL],
                  ["NO_VERBAL", MODALIDAD_LABEL.NO_VERBAL],
                ] as const
              ).map(([val, label]) => (
                <label key={val} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="modalidadLenguaje"
                    value={val}
                    checked={modalidad === val}
                    onChange={() => setModalidad(val)}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
          <div className="space-y-4">
            {area.grupos.map((grupo, gi) => (
              // Se oculta con CSS en vez de desmontarlo: así los inputs siguen
              // en el DOM y no se pierde lo escrito si se alterna la modalidad.
              // El descarte definitivo lo hace el server al guardar.
              <div key={gi} hidden={!grupoAplica(grupo, modalidad)}>
                {grupo.titulo && (
                  <h3 className="mb-2 text-sm font-medium text-slate-600">
                    {grupo.titulo}
                  </h3>
                )}
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {grupo.items.map((item) => {
                    const r = res[item.id];
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      >
                        <span className="text-sm text-slate-700">
                          {item.label}
                        </span>
                        <div className="flex flex-wrap items-center gap-3">
                          {area.conObservacion && (
                            <Input
                              name={`obs_${item.id}`}
                              defaultValue={r?.obs ?? ""}
                              placeholder="Observación"
                              className="w-40 py-1"
                            />
                          )}
                          <RadiosItem
                            itemId={item.id}
                            valores={
                              area.tipo === "IPL"
                                ? (["I", "P", "L"] as const)
                                : (["SI", "NO"] as const)
                            }
                            actual={r?.valor}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {area.id === "sensorial" && (
            <Field label="Observación (hipo – híper sensibilidad)" className="mt-4">
              <Textarea
                name="observacionSensorial"
                defaultValue={v.observacionSensorial ?? ""}
              />
            </Field>
          )}
          {area.id === "psicomotricidad" && (
            <Field label="Observación (presenta problemas motrices)" className="mt-4">
              <Textarea
                name="observacionMotriz"
                defaultValue={v.observacionMotriz ?? ""}
              />
            </Field>
          )}
        </Seccion>
      ))}

      <Seccion titulo="X. Observación durante la evaluación">
        <Textarea
          name="observacionGeneral"
          defaultValue={v.observacionGeneral ?? ""}
        />
      </Seccion>

      <Seccion titulo="Resultado: programa recomendado">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Programa recomendado">
            <Select
              name="programaRecomendado"
              defaultValue={v.programaRecomendado ?? ""}
            >
              <option value="">— Seleccione —</option>
              <option value="ESCOLAR">Escolar</option>
              <option value="INTERDIARIO">Terapias Grupales</option>
              <option value="TERAPIAS">Terapia Individual</option>
            </Select>
          </Field>
          <Field label="Recomendaciones">
            <Textarea name="recomendaciones" defaultValue={v.recomendaciones ?? ""} />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="aplicarPrograma" />
          Actualizar el programa del paciente con el recomendado al guardar
        </label>
      </Seccion>

      <div className="flex items-center justify-end gap-3">
        <ButtonLink href={cancelarHref} variant="secondary">
          Cancelar
        </ButtonLink>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar evaluación"}
        </Button>
      </div>
    </form>
  );
}
