import { Card, Field, Select, Textarea } from "@/components/ui";

/**
 * Bloque final de la ficha de evaluación. NO es parte de la plantilla: el
 * programa recomendado sale de la ficha hacia `Paciente.programa` y su dominio
 * es el enum Programa, no texto libre que un centro pueda editar. Una plantilla
 * puede ocultarlo (`muestraProgramaRecomendado`), por ejemplo en terapia física.
 */
export function ProgramaRecomendado({
  programaRecomendado,
  recomendaciones,
}: {
  programaRecomendado?: string | null;
  recomendaciones?: string | null;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Resultado: programa recomendado
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Programa recomendado">
          <Select name="programaRecomendado" defaultValue={programaRecomendado ?? ""}>
            <option value="">— Seleccione —</option>
            <option value="ESCOLAR">Escolar</option>
            <option value="INTERDIARIO">Terapias Grupales</option>
            <option value="TERAPIAS">Terapia Individual</option>
          </Select>
        </Field>
        <Field label="Recomendaciones">
          <Textarea name="recomendaciones" defaultValue={recomendaciones ?? ""} />
        </Field>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="aplicarPrograma" />
        Actualizar el programa del paciente con el recomendado al guardar
      </label>
    </Card>
  );
}
