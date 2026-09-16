import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { obtenerPlantilla } from "@/lib/plantillas";
import { camposDe } from "@/lib/fichas/plantilla";
import { BASES } from "@/lib/fichas/base";
import { TIPOS_FICHA, TIPO_FICHA_LABEL } from "@/lib/fichas/tipos";

const DESCRIPCION: Record<string, string> = {
  HISTORIA: "Anamnesis del paciente. Sigue siempre la plantilla vigente del centro.",
  EVALUACION:
    "Instrumento que se aplica en una fecha. Cada ficha conserva la plantilla con la que se aplicó.",
  INFORME:
    "Avance periódico con la escala EI / EP / LE. Siembra el primer informe de cada paciente.",
};

export default async function FichasClinicasPage() {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const plantillas = await Promise.all(
    TIPOS_FICHA.map(async (tipo) => {
      const { plantilla, version, base } = await obtenerPlantilla(user.centroId, tipo);
      const campos = camposDe(plantilla);
      return {
        tipo,
        version,
        base,
        secciones: plantilla.secciones.length,
        campos: campos.length,
        items: campos.reduce((n, c) => n + (c.tipo === "checklist" ? c.items.length : 0), 0),
      };
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fichas clínicas"
        subtitle="Estructura de las fichas de este centro. Aplica a todas sus sedes."
      />

      <p className="max-w-3xl text-sm text-slate-600">
        Estas plantillas definen qué preguntas y qué ítems tiene cada ficha, de modo
        que el sistema sirva tanto a terapia psicológica como física. Editar una
        plantilla no cambia las fichas ya firmadas: las evaluaciones e informes
        conservan la estructura con la que se registraron.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plantillas.map((p) => (
          <Link key={p.tipo} href={`/configuracion/fichas/${p.tipo}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <p className="text-lg font-semibold text-slate-900">
                {TIPO_FICHA_LABEL[p.tipo]}
              </p>
              <p className="mt-1 text-sm text-slate-500">{DESCRIPCION[p.tipo]}</p>
              <p className="mt-3 text-xs text-slate-500">
                {p.secciones} secciones · {p.campos} campos
                {p.items > 0 ? ` · ${p.items} ítems` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {p.version === 0
                  ? `Sin personalizar (${BASES.psicologica.label})`
                  : `Versión ${p.version} · base ${
                      p.base in BASES ? BASES[p.base as keyof typeof BASES].label : p.base
                    }`}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
