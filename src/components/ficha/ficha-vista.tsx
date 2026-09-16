// Vista de lectura (y de impresión) de una ficha clínica registrada.
// Componente de servidor: recorre la plantilla y pinta lo guardado.

import type { ReactNode } from "react";
import { Badge, Card } from "@/components/ui";
import { conObservacion, escalaDe, grupoVisible } from "@/lib/fichas/plantilla";
import { tituloGrupo, tituloSeccion } from "@/lib/fichas/numeracion";
import { huerfanos } from "@/lib/fichas/valores";
import type { Campo, Plantilla, ValorCampo, ValoresFicha } from "@/lib/fichas/tipos";

const ETIQUETA = "mb-1 block text-sm font-medium text-slate-700";

export function Dato({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className={ETIQUETA}>{label}</dt>
      <dd className="text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export function DatoLargo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="sm:col-span-2">
      <dt className={ETIQUETA}>{label}</dt>
      <dd className="whitespace-pre-line text-sm text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function TablaLeida({
  campo,
  valor,
}: {
  campo: Extract<Campo, { tipo: "tabla" }>;
  valor?: ValorCampo;
}) {
  const filas = valor?.t === "tabla" ? valor.filas : [];
  if (filas.length === 0) {
    return (
      <div className="sm:col-span-2">
        <dt className={ETIQUETA}>{campo.label}</dt>
        <dd className="text-sm text-slate-500">Sin datos registrados.</dd>
      </div>
    );
  }
  return (
    <div className="sm:col-span-2">
      <dt className={ETIQUETA}>{campo.label}</dt>
      <dd className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              {campo.columnas.map((c) => (
                <th key={c.id} className="pb-2 pr-3">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((fila, i) => (
              <tr key={i}>
                {campo.columnas.map((c) => (
                  <td key={c.id} className="py-2 pr-3 text-slate-800">
                    {fila[c.id] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </dd>
    </div>
  );
}

function ChecklistLeido({
  campo,
  valor,
  plantilla,
  seccion,
}: {
  campo: Extract<Campo, { tipo: "checklist" }>;
  valor?: ValorCampo;
  plantilla: Plantilla;
  seccion: Plantilla["secciones"][number];
}) {
  const escala = escalaDe(plantilla, seccion, campo);
  const registrados = valor?.t === "checklist" ? valor.items : {};
  const conObs = conObservacion(seccion, campo);
  if (!escala) return null;

  return (
    <div className="sm:col-span-2">
      {campo.label && <dt className={ETIQUETA}>{campo.label}</dt>}
      <dd className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Ítem</th>
              {escala.valores.map((v) => (
                <th key={v} className="w-14 pb-2 text-center" title={escala.labels[v]}>
                  {v}
                </th>
              ))}
              {conObs && <th className="pb-2 pl-3">Observación</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campo.items.map((item) => {
              const actual = registrados[item.id];
              return (
                <tr key={item.id}>
                  <td className="py-2 pr-3 text-slate-800">{item.label}</td>
                  {escala.valores.map((v) => (
                    <td key={v} className="py-2 text-center text-slate-700">
                      {actual?.valor === v ? "✓" : ""}
                    </td>
                  ))}
                  {conObs && (
                    <td className="py-2 pl-3 text-slate-600">{actual?.obs ?? ""}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </dd>
    </div>
  );
}

function CampoLeido({
  campo,
  valor,
  plantilla,
  seccion,
}: {
  campo: Campo;
  valor?: ValorCampo;
  plantilla: Plantilla;
  seccion: Plantilla["secciones"][number];
}) {
  switch (campo.tipo) {
    case "texto":
      return <Dato label={campo.label} value={valor?.t === "texto" ? valor.v : null} />;
    case "parrafo":
      return <DatoLargo label={campo.label} value={valor?.t === "texto" ? valor.v : null} />;
    case "casilla":
      return (
        <Dato
          label={campo.label}
          value={valor?.t === "casilla" && valor.v ? <Badge color="sky">Sí</Badge> : "No"}
        />
      );
    case "opciones": {
      const elegidos = valor?.t === "opciones" ? valor.v : [];
      const labels = elegidos.map(
        (v) => campo.opciones.find((o) => o.valor === v)?.label ?? v,
      );
      return (
        <Dato
          label={campo.label}
          value={
            labels.length === 0 ? null : (
              <span className="flex flex-wrap gap-2">
                {labels.map((l) => (
                  <Badge key={l} color="sky">
                    {l}
                  </Badge>
                ))}
              </span>
            )
          }
        />
      );
    }
    case "tabla":
      return <TablaLeida campo={campo} valor={valor} />;
    case "checklist":
      return (
        <ChecklistLeido campo={campo} valor={valor} plantilla={plantilla} seccion={seccion} />
      );
  }
}

/** Texto plano de un valor huérfano, para el bloque de datos antiguos. */
function textoHuerfano(valor: ValorCampo): string {
  switch (valor.t) {
    case "texto":
      return valor.v;
    case "casilla":
      return valor.v ? "Sí" : "No";
    case "opciones":
      return valor.v.join(", ");
    case "tabla":
      return valor.filas.map((f) => Object.values(f).join(" · ")).join(" | ");
    case "checklist":
      return Object.entries(valor.items)
        .map(([id, i]) => `${id}: ${[i.valor, i.obs].filter(Boolean).join(" — ")}`)
        .join(" | ");
  }
}

export function FichaVista({
  plantilla,
  valores,
  encabezado,
}: {
  plantilla: Plantilla;
  valores: ValoresFicha;
  /** Datos del paciente que van dentro de la primera sección impresa. */
  encabezado?: ReactNode;
}) {
  const antiguos = huerfanos(valores, plantilla);

  return (
    <div className="space-y-6">
      {plantilla.secciones.map((seccion, si) => (
        <Card key={seccion.id}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {tituloSeccion(seccion.titulo, si, plantilla.numerarSecciones)}
          </h2>
          {si === 0 && encabezado}
          <div className="space-y-5">
            {seccion.grupos
              // Un grupo condicionado solo se muestra si corresponde a lo
              // registrado: no tiene sentido imprimir la modalidad que no se evaluó.
              .filter((g) => grupoVisible(g, valores))
              .map((grupo, gi) => (
                <div key={grupo.id}>
                  {grupo.titulo && (
                    <h3 className="mb-2 text-sm font-medium text-slate-600">
                      {tituloGrupo(
                        grupo.titulo,
                        si,
                        gi,
                        plantilla.numerarSecciones,
                        seccion.numerarGrupos,
                      )}
                    </h3>
                  )}
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {grupo.campos.map((campo) => (
                      <CampoLeido
                        key={campo.id}
                        campo={campo}
                        valor={valores[campo.id]}
                        plantilla={plantilla}
                        seccion={seccion}
                      />
                    ))}
                  </dl>
                </div>
              ))}
          </div>
        </Card>
      ))}

      {antiguos.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-900">
            Registrado con una versión anterior de la plantilla
          </h2>
          <p className="mb-4 text-xs text-amber-800">
            Estos datos se registraron con campos que ya no están en la plantilla del
            centro. No se borran: quedan aquí para no perder lo escrito.
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            {antiguos.map(([id, valor]) => (
              <Dato key={id} label={id} value={textoHuerfano(valor)} />
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
