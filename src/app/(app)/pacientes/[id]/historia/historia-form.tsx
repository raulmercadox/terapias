"use client";

import { useState, useActionState } from "react";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import type { FormState } from "./actions";
import { REACCIONES_PADRES, type Familiar } from "./historia";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type HistoriaInicial = {
  fecha?: string; // yyyy-mm-dd
  lugarNacimiento?: string | null;
  padreApoderado?: string | null;
  familiares?: Familiar[];
  historiaPrePostnatal?: string | null;
  presentacionDificultad?: string | null;
  signosSintomas?: string | null;
  tempranaCentro?: string | null;
  tempranaAdaptacion?: string | null;
  kinderCentro?: string | null;
  kinderAdaptacion?: string | null;
  evolucionMejoria?: string | null;
  examenesRealizados?: string | null;
  tratamientosRecibidos?: string | null;
  indicacionesDoctor?: string | null;
  medicinasRecomendadas?: string | null;
  dosis?: string | null;
  tiempoInicio?: string | null;
  mejoriaMedicacion?: string | null;
  alimentacion?: string | null;
  controlEsfinteres?: string | null;
  sueno?: string | null;
  autonomiaPersonal?: string | null;
  reaccionRechazo?: boolean;
  reaccionIndiferencia?: boolean;
  reaccionAceptacion?: boolean;
  reaccionPreocupacion?: boolean;
  reaccionVerguenza?: boolean;
  reaccionDetalle?: string | null;
  creencias?: string | null;
  cambiosCrianza?: string | null;
  usoCastigo?: string | null;
  comportamientoApego?: string | null;
  enfermedadesFamiliares?: string | null;
  caracterPadres?: string | null;
  observacionesEntrevista?: string | null;
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

const FILAS_FAMILIA_DEFECTO: Familiar[] = [
  { parentesco: "Padre" },
  { parentesco: "Madre" },
  { parentesco: "Hermano(a)" },
];

/**
 * Tabla dinámica "2.1 Historia Familiar". Cada fila envía los campos
 * fam_parentesco, fam_nombres, fam_edad, fam_ocupacion y fam_relacion;
 * el servidor los alinea por índice con getAll.
 */
function TablaFamiliares({ iniciales }: { iniciales?: Familiar[] }) {
  const [filas, setFilas] = useState<Familiar[]>(
    iniciales && iniciales.length > 0 ? iniciales : FILAS_FAMILIA_DEFECTO,
  );

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-2">Parentesco</th>
              <th className="pb-2 pr-2">Nombres</th>
              <th className="w-16 pb-2 pr-2">Edad</th>
              <th className="pb-2 pr-2">Ocupación</th>
              <th className="pb-2 pr-2">Relación con el evaluado</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={i} className="align-top">
                <td className="py-1 pr-2">
                  <Input name="fam_parentesco" defaultValue={fila.parentesco ?? ""} />
                </td>
                <td className="py-1 pr-2">
                  <Input name="fam_nombres" defaultValue={fila.nombres ?? ""} />
                </td>
                <td className="py-1 pr-2">
                  <Input name="fam_edad" defaultValue={fila.edad ?? ""} />
                </td>
                <td className="py-1 pr-2">
                  <Input name="fam_ocupacion" defaultValue={fila.ocupacion ?? ""} />
                </td>
                <td className="py-1 pr-2">
                  <Input name="fam_relacion" defaultValue={fila.relacion ?? ""} />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    onClick={() => setFilas(filas.filter((_, j) => j !== i))}
                    className="rounded px-2 py-1.5 text-xs text-red-500 hover:bg-red-50"
                    aria-label="Quitar fila"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setFilas([...filas, {}])}
      >
        Agregar familiar
      </Button>
    </div>
  );
}

export function HistoriaForm({
  action,
  inicial,
  cancelarHref,
}: {
  action: Action;
  inicial?: HistoriaInicial;
  cancelarHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const v = inicial ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <Seccion titulo="I. Datos generales">
        <p className="mb-4 text-xs text-slate-500">
          Los datos básicos (nombres, edad, fecha de nacimiento, dirección,
          teléfono) se toman de la ficha del paciente.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de la historia" required>
            <Input type="date" name="fecha" defaultValue={v.fecha ?? ""} required />
          </Field>
          <Field label="Lugar de nacimiento">
            <Input name="lugarNacimiento" defaultValue={v.lugarNacimiento ?? ""} />
          </Field>
          <Field label="Padre o apoderado">
            <Input name="padreApoderado" defaultValue={v.padreApoderado ?? ""} />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="II.1 Historia familiar">
        <TablaFamiliares iniciales={v.familiares} />
      </Seccion>

      <Seccion titulo="II.2 Historia pre - postnatal">
        <div className="grid gap-4">
          <Field label="Historia pre - postnatal">
            <Textarea
              name="historiaPrePostnatal"
              defaultValue={v.historiaPrePostnatal ?? ""}
            />
          </Field>
          <Field label="¿Cómo se presentó esta dificultad? ¿Desde cuándo? ¿Quién lo detectó?">
            <Textarea
              name="presentacionDificultad"
              defaultValue={v.presentacionDificultad ?? ""}
            />
          </Field>
          <Field label="Signos y síntomas principales">
            <Textarea name="signosSintomas" defaultValue={v.signosSintomas ?? ""} />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="II.3 Historia escolar">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E. Temprana: centro educativo">
            <Input name="tempranaCentro" defaultValue={v.tempranaCentro ?? ""} />
          </Field>
          <Field label="E. Temprana: adaptación / dificultades">
            <Input
              name="tempranaAdaptacion"
              defaultValue={v.tempranaAdaptacion ?? ""}
            />
          </Field>
          <Field label="Kinder: centro educativo">
            <Input name="kinderCentro" defaultValue={v.kinderCentro ?? ""} />
          </Field>
          <Field label="Kinder: adaptación / dificultades">
            <Input name="kinderAdaptacion" defaultValue={v.kinderAdaptacion ?? ""} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4">
          <Field label="¿Cómo ha evolucionado desde que apareció por primera vez? ¿Ha notado alguna mejoría?">
            <Textarea
              name="evolucionMejoria"
              defaultValue={v.evolucionMejoria ?? ""}
            />
          </Field>
          <Field label="Exámenes realizados">
            <Textarea
              name="examenesRealizados"
              defaultValue={v.examenesRealizados ?? ""}
            />
          </Field>
          <Field label="Tratamiento – terapias recibidas: ¿cuánto tiempo?, ¿en qué instituciones?, evolución del tratamiento">
            <Textarea
              name="tratamientosRecibidos"
              defaultValue={v.tratamientosRecibidos ?? ""}
            />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="II.4 Tratamiento farmacológico – medicación">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Indicaciones del doctor">
            <Input
              name="indicacionesDoctor"
              defaultValue={v.indicacionesDoctor ?? ""}
            />
          </Field>
          <Field label="Medicinas recomendadas">
            <Input
              name="medicinasRecomendadas"
              defaultValue={v.medicinasRecomendadas ?? ""}
            />
          </Field>
          <Field label="Dosis">
            <Input name="dosis" defaultValue={v.dosis ?? ""} />
          </Field>
          <Field label="Tiempo de inicio">
            <Input name="tiempoInicio" defaultValue={v.tiempoInicio ?? ""} />
          </Field>
          <Field
            label="Observaciones: ¿qué mejoría presenta el menor?"
            className="sm:col-span-2"
          >
            <Textarea
              name="mejoriaMedicacion"
              defaultValue={v.mejoriaMedicacion ?? ""}
            />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="III. Formación de hábitos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Alimentación">
            <Input name="alimentacion" defaultValue={v.alimentacion ?? ""} />
          </Field>
          <Field label="Control de esfínteres">
            <Input
              name="controlEsfinteres"
              defaultValue={v.controlEsfinteres ?? ""}
            />
          </Field>
          <Field label="Sueño">
            <Input name="sueno" defaultValue={v.sueno ?? ""} />
          </Field>
          <Field label="Nivel de autonomía personal">
            <Input
              name="autonomiaPersonal"
              defaultValue={v.autonomiaPersonal ?? ""}
            />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="IV. Opinión y actitud del padre hacia el hijo">
        <div className="mb-2 text-sm font-medium text-slate-600">
          Reacción de los padres
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-5">
          {REACCIONES_PADRES.map((r) => (
            <label
              key={r.id}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name={r.id}
                defaultChecked={v[r.id] ?? false}
              />
              {r.label}
            </label>
          ))}
        </div>
        <div className="grid gap-4">
          <Field label="Detalle de la reacción">
            <Textarea name="reaccionDetalle" defaultValue={v.reaccionDetalle ?? ""} />
          </Field>
          <Field label="Creencias sobre el problema, sentimientos de culpa, etc.">
            <Textarea name="creencias" defaultValue={v.creencias ?? ""} />
          </Field>
          <Field label="Cambios: aislarlo o dejarlo con el grupo, exigirle un comportamiento similar, mayor atención, sobreprotección…">
            <Textarea name="cambiosCrianza" defaultValue={v.cambiosCrianza ?? ""} />
          </Field>
          <Field label="Uso del castigo: ¿cómo, con qué frecuencia? Reacción del niño">
            <Textarea name="usoCastigo" defaultValue={v.usoCastigo ?? ""} />
          </Field>
          <Field label="Comportamiento del niño con los padres, hermanos, amigos, otros. Apego del niño, ¿hacia quién?">
            <Textarea
              name="comportamientoApego"
              defaultValue={v.comportamientoApego ?? ""}
            />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="V. Antecedentes familiares">
        <div className="grid gap-4">
          <Field label="¿Enfermedad/condición en la familia? (SI/NO, especificar)">
            <Textarea
              name="enfermedadesFamiliares"
              defaultValue={v.enfermedadesFamiliares ?? ""}
            />
          </Field>
          <Field label="Carácter de los padres. Relación de pareja">
            <Textarea name="caracterPadres" defaultValue={v.caracterPadres ?? ""} />
          </Field>
        </div>
      </Seccion>

      <Seccion titulo="VI. Observaciones durante la entrevista">
        <Textarea
          name="observacionesEntrevista"
          defaultValue={v.observacionesEntrevista ?? ""}
        />
      </Seccion>

      <div className="flex items-center justify-end gap-3">
        <ButtonLink href={cancelarHref} variant="secondary">
          Cancelar
        </ButtonLink>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar historia clínica"}
        </Button>
      </div>
    </form>
  );
}
