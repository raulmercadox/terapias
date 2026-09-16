import { Card, Field, Select, Textarea } from "@/components/ui";

/**
 * Cierre de la ficha de evaluación. NO es parte de la plantilla.
 *
 * Las recomendaciones se piden SIEMPRE: son la conclusión del profesional y
 * valen en cualquier rubro. El programa recomendado, en cambio, solo aparece si
 * la plantilla lo pide (`muestraProgramaRecomendado`): sale de la ficha hacia
 * `Paciente.programa` y su dominio es el enum Programa, no texto libre, así que
 * un centro de terapia física no lo usa.
 */
export function CierreEvaluacion({
  muestraPrograma,
  programaRecomendado,
  recomendaciones,
}: {
  muestraPrograma: boolean;
  programaRecomendado?: string | null;
  recomendaciones?: string | null;
}) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {muestraPrograma ? "Resultado: programa recomendado" : "Recomendaciones"}
      </h2>

      {muestraPrograma ? (
        <>
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
        </>
      ) : (
        <Field label="Conclusiones y plan sugerido">
          <Textarea name="recomendaciones" rows={5} defaultValue={recomendaciones ?? ""} />
        </Field>
      )}
    </Card>
  );
}
