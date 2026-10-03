import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { obtenerPlantilla } from "@/lib/plantillas";
import { TIPOS_FICHA, TIPO_FICHA_LABEL, type TipoFicha } from "@/lib/fichas/tipos";
import { PlantillaForm } from "./plantilla-form";

export default async function EditarPlantillaPage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const [{ tipo: tipoParam }, { ok }] = await Promise.all([params, searchParams]);
  if (!(TIPOS_FICHA as readonly string[]).includes(tipoParam)) notFound();
  const tipo = tipoParam as TipoFicha;

  const { plantilla, version } = await obtenerPlantilla(user.centroId, tipo);

  return (
    <div className="space-y-6">
      <PageHeader
        title={TIPO_FICHA_LABEL[tipo]}
        subtitle={
          version === 0
            ? "Plantilla base del sistema. Al guardar se crea la del centro."
            : `Plantilla del centro · versión ${version}`
        }
        actions={
          <ButtonLink href="/configuracion/fichas" variant="secondary">
            Volver
          </ButtonLink>
        }
      />

      {ok === "1" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Plantilla guardada.
        </p>
      )}

      <Card className="border-sky-200 bg-sky-50">
        <p className="text-sm text-sky-900">
          Se pueden agregar, quitar, reordenar y renombrar secciones y campos, y editar
          los ítems de las listas de evaluación. El tipo de un campo existente, las
          escalas y las columnas de las tablas no se editan aquí.
        </p>
        <p className="mt-2 text-xs text-sky-800">
          Quitar un campo no borra lo ya registrado: las fichas lo muestran como dato
          antiguo. Al renombrar un ítem se conserva su identificador, de modo que el
          progreso histórico del paciente sigue siendo comparable.
        </p>
      </Card>

      <div className="max-w-4xl">
        {/* key: tras guardar, el formulario se rearma desde la plantilla nueva
            (los campos recién creados ya tienen id y dejan de ser "nuevos"). */}
        <PlantillaForm key={version} tipo={tipo} plantilla={plantilla} />
      </div>
    </div>
  );
}
