import { notFound } from "next/navigation";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { nombreCompleto, edad, fecha, hoyLima } from "@/lib/utils";
import { obtenerPlantilla } from "@/lib/plantillas";
import {
  normalizarSecciones,
  seccionesDePlantilla,
  seccionesSinValores,
} from "../informe";
import { InformeForm } from "../informe-form";
import { crearInforme } from "../actions";

export default async function NuevoInformePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const paciente = await prisma.paciente.findUnique({
    where: { id },
    select: {
      id: true,
      sedeId: true,
      nombres: true,
      apellidoPaterno: true,
      apellidoMaterno: true,
      fechaNacimiento: true,
    },
  });
  if (!paciente || !(await canAccessSede(user, paciente.sedeId))) notFound();

  const terapeutas = await prisma.terapeuta.findMany({
    where: { sedeId: paciente.sedeId, activo: true },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    select: { id: true, nombres: true, apellidos: true },
  });

  // El informe nuevo parte del último informe del paciente —sus ítems y textos,
  // con las calificaciones en blanco— y solo cae en la plantilla del centro si
  // es el primero. Además de ahorrar retipeo, es lo que mantiene comparables los
  // ítems agregados a mano: llevan un id propio que se perdería al reiniciar
  // desde la plantilla, y sin ese id no hay serie de progreso (ver
  // progreso/progreso.ts).
  const anterior = await prisma.informeAvance.findFirst({
    where: { pacienteId: paciente.id },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    select: { fecha: true, secciones: true },
  });

  const { plantilla } = await obtenerPlantilla(user.centroId, "INFORME");
  const secciones = anterior
    ? seccionesSinValores(normalizarSecciones(anterior.secciones))
    : seccionesDePlantilla(plantilla);

  const accion = crearInforme.bind(null, paciente.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo informe de avance"
        subtitle={`${nombreCompleto(paciente)} · ${edad(paciente.fechaNacimiento)}`}
      />
      <div className="max-w-4xl space-y-4">
        {anterior && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Se precargaron los ítems del informe del {fecha(anterior.fecha)} sin
            sus calificaciones. Manteniendo los mismos ítems, el progreso del
            paciente queda comparable entre informes.
          </p>
        )}
        <InformeForm
          action={accion}
          terapeutas={terapeutas.map((t) => ({
            id: t.id,
            nombre: `${t.nombres} ${t.apellidos}`.trim(),
          }))}
          inicial={{ fecha: hoyLima(), secciones }}
          cancelarHref={`/pacientes/${paciente.id}`}
        />
      </div>
    </div>
  );
}
