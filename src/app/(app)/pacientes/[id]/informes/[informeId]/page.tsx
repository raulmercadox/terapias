import { notFound } from "next/navigation";
import { CentroLogo } from "@/components/centro-logo";
import {
  requireUser,
  canAccessSede,
  getCentro,
  puedeVerPagos,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader, ButtonLink } from "@/components/ui";
import { nombreCompleto, fecha } from "@/lib/utils";
import {
  VALORES_INFORME,
  VALOR_LABEL,
  normalizarSecciones,
  type SeccionInforme,
} from "../informe";
import { EliminarInformeBoton } from "./eliminar-boton";
import { ImprimirBoton } from "./imprimir-boton";

function TablaSeccion({ seccion }: { seccion: SeccionInforme }) {
  return (
    <table className="mb-6 w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="border border-slate-400 bg-slate-50 px-3 py-2 text-center font-semibold">
            {seccion.titulo}
          </th>
          {VALORES_INFORME.map((v) => (
            <th
              key={v}
              className="w-12 border border-slate-400 bg-slate-50 px-2 py-2 text-center font-semibold"
            >
              {v}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {seccion.items.length === 0 ? (
          <tr>
            <td
              colSpan={4}
              className="border border-slate-400 px-3 py-2 text-center text-slate-500"
            >
              Sin ítems registrados.
            </td>
          </tr>
        ) : (
          seccion.items.map((item) => (
            <tr key={item.id}>
              <td className="border border-slate-400 px-3 py-2 text-center">
                {item.label}
              </td>
              {VALORES_INFORME.map((v) => (
                <td
                  key={v}
                  className="border border-slate-400 px-2 py-2 text-center"
                  aria-label={item.valor === v ? VALOR_LABEL[v] : undefined}
                >
                  {item.valor === v ? "✓" : ""}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default async function InformeAvancePage({
  params,
}: {
  params: Promise<{ id: string; informeId: string }>;
}) {
  const { id, informeId } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const informe = await prisma.informeAvance.findUnique({
    where: { id: informeId },
    include: {
      paciente: true,
      evaluador: { select: { nombres: true, apellidos: true } },
      sede: { select: { nombre: true, direccion: true, telefono: true } },
    },
  });
  if (!informe || informe.pacienteId !== id) notFound();
  if (!(await canAccessSede(user, informe.sedeId))) notFound();
  const centro = await getCentro(user.centroId);

  const secciones = normalizarSecciones(informe.secciones);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Informe de avance"
        subtitle={`${nombreCompleto(informe.paciente)} · ${fecha(informe.fecha)}`}
        actions={
          <>
            <ButtonLink href={`/pacientes/${id}`} variant="secondary">
              Volver al paciente
            </ButtonLink>
            <ButtonLink
              href={`/pacientes/${id}/informes/${informeId}/editar`}
              variant="secondary"
            >
              Editar
            </ButtonLink>
            {user.rol === "ADMINISTRADOR" && (
              <EliminarInformeBoton informeId={informeId} />
            )}
          </>
        }
      />

      <ImprimirBoton />

      {/* print-area: al imprimir se oculta todo lo demás (ver globals.css). */}
      <div className="print-area mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white p-8 text-slate-900 shadow-sm">
        <div className="mb-5 border-b border-slate-300 pb-3 text-center">
          <CentroLogo logoActualizadoEn={centro.logoActualizadoEn} className="mx-auto mb-2 block h-14 w-auto max-w-48" />
          <p className="text-base font-bold">{centro.nombre}</p>
          {centro.subtitulo && (
            <p className="text-xs text-slate-600">{centro.subtitulo}</p>
          )}
        </div>
        <h1 className="mb-6 text-center text-lg font-bold underline">
          INFORME DE AVANCE
        </h1>

        <dl className="mb-5 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-semibold">Nombres y apellido</dt>
            <dd>: {nombreCompleto(informe.paciente)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold">Fecha de informe</dt>
            <dd>: {fecha(informe.fecha)}</dd>
          </div>
          {informe.evaluador && (
            <div className="flex gap-2">
              <dt className="font-semibold">Profesional</dt>
              <dd>
                :{" "}
                {`${informe.evaluador.nombres} ${informe.evaluador.apellidos}`.trim()}
              </dd>
            </div>
          )}
        </dl>

        <div className="mb-4 flex flex-wrap justify-between gap-x-8 gap-y-1 text-xs">
          {VALORES_INFORME.map((v) => (
            <span key={v}>
              <strong>{v}</strong> = {VALOR_LABEL[v]}
            </span>
          ))}
        </div>

        {secciones.map((s) => (
          <TablaSeccion key={s.id} seccion={s} />
        ))}

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold">Recomendaciones:</h2>
          <div className="min-h-24 whitespace-pre-line rounded border border-slate-400 p-3 text-sm">
            {informe.recomendaciones || "—"}
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between gap-4 text-xs text-slate-600">
          <span className="uppercase">Este documento carece de valor legal</span>
          <span className="text-right italic">
            {informe.sede.direccion && <>{informe.sede.direccion}</>}
            {informe.sede.telefono && (
              <>
                <br />
                Teléfono: {informe.sede.telefono}
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
