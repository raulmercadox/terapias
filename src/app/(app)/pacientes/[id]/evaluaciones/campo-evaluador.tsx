import { Field, Input, Select } from "@/components/ui";

type Opcion = { id: string; nombres: string; apellidos: string };

/**
 * Evaluador de la ficha. Para el terapeuta queda fijo en él mismo (solo
 * lectura); los demás roles eligen entre los terapeutas de la sede.
 */
export function CampoEvaluador({
  terapeutas,
  evaluadorId,
  evaluadorFijo,
}: {
  terapeutas: Opcion[];
  evaluadorId?: string | null;
  evaluadorFijo?: { id: string; nombre: string };
}) {
  return (
    <Field label="Evaluador(a)">
      {evaluadorFijo ? (
        <>
          <input type="hidden" name="evaluadorId" value={evaluadorFijo.id} />
          <Input value={evaluadorFijo.nombre} readOnly disabled />
        </>
      ) : (
        <Select name="evaluadorId" defaultValue={evaluadorId ?? ""}>
          <option value="">— Seleccione —</option>
          {terapeutas.map((t) => (
            <option key={t.id} value={t.id}>
              {`${t.nombres} ${t.apellidos}`.trim()}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
