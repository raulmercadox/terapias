import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSede, puedeVerPagos } from "@/lib/session";
import { soles, fecha, nombreCompleto } from "@/lib/utils";
import { normalizarTelefonoPe } from "../../../citas/helpers";
import { PrintActions } from "./print-button";

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

const CONCEPTO_LABEL: Record<string, string> = {
  MATRICULA: "Matrícula",
  MATERIALES: "Materiales",
  MENSUALIDAD: "Mensualidad",
  PAQUETE_SESIONES: "Paquete de sesiones",
  EVALUACION: "Evaluación",
  OTRO: "Otro",
};

const FECHA_HORA = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeVerPagos(user)) notFound();

  const pago = await prisma.pago.findUnique({
    where: { id },
    select: {
      id: true,
      sedeId: true,
      numeroRecibo: true,
      concepto: true,
      descripcion: true,
      monto: true,
      saldo: true,
      metodoPago: true,
      referencia: true,
      fechaPago: true,
      sede: { select: { nombre: true, direccion: true, telefono: true } },
      paciente: {
        select: {
          nombres: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          dni: true,
          telefono: true,
          apoderados: {
            orderBy: { principal: "desc" },
            select: { nombres: true, telefono: true, principal: true },
          },
        },
      },
    },
  });

  if (!pago || !canAccessSede(user, pago.sedeId)) notFound();

  // Teléfono: apoderado principal > primer apoderado con teléfono > paciente.
  const apoderado =
    pago.paciente.apoderados.find((a) => a.principal && a.telefono) ??
    pago.paciente.apoderados.find((a) => a.telefono);
  const telefono = normalizarTelefonoPe(
    apoderado?.telefono ?? pago.paciente.telefono,
  );

  const conceptoLabel = CONCEPTO_LABEL[pago.concepto] ?? pago.concepto;
  const mensajeWhatsApp =
    `*Centro B-Genius* — Recibo ${pago.numeroRecibo}\n` +
    `Paciente: ${nombreCompleto(pago.paciente)}\n` +
    `Concepto: ${conceptoLabel}\n` +
    `Fecha: ${fecha(pago.fechaPago)}\n` +
    `Monto pagado: ${soles(pago.monto)}\n` +
    (Number(pago.saldo) > 0 ? `Saldo pendiente: ${soles(pago.saldo)}\n` : "") +
    `\nDocumento interno sin valor tributario. ¡Gracias por su pago!`;

  return (
    <div className="space-y-4">
      <PrintActions telefono={telefono} mensaje={mensajeWhatsApp} />

      <div className="print-area mx-auto max-w-2xl rounded-xl border border-slate-300 bg-white p-8 text-slate-900 shadow-sm">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-slate-300 pb-4">
          <div>
            <h1 className="text-xl font-bold">Centro B-Genius</h1>
            <p className="text-sm text-slate-600">Terapias / Aula Azul</p>
            <p className="mt-1 text-sm font-medium">Sede: {pago.sede.nombre}</p>
            {pago.sede.direccion && (
              <p className="text-xs text-slate-500">{pago.sede.direccion}</p>
            )}
            {pago.sede.telefono && (
              <p className="text-xs text-slate-500">Tel.: {pago.sede.telefono}</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-300 px-4 py-2 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Recibo interno
            </p>
            <p className="text-lg font-bold">{pago.numeroRecibo}</p>
            <p className="mt-1 text-xs text-slate-500">
              {FECHA_HORA.format(pago.fechaPago)}
            </p>
          </div>
        </div>

        {/* Paciente */}
        <div className="grid gap-1 border-b border-slate-200 py-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Paciente</span>
            <span className="font-medium">{nombreCompleto(pago.paciente)}</span>
          </div>
          {pago.paciente.dni && (
            <div className="flex justify-between">
              <span className="text-slate-500">DNI</span>
              <span>{pago.paciente.dni}</span>
            </div>
          )}
        </div>

        {/* Detalle */}
        <div className="py-4 text-sm">
          <div className="flex justify-between border-b border-slate-100 py-2">
            <span className="text-slate-500">Concepto</span>
            <span className="font-medium">
              {CONCEPTO_LABEL[pago.concepto] ?? pago.concepto}
            </span>
          </div>
          {pago.descripcion && (
            <div className="flex justify-between border-b border-slate-100 py-2">
              <span className="text-slate-500">Descripción</span>
              <span className="max-w-xs text-right">{pago.descripcion}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-slate-100 py-2">
            <span className="text-slate-500">Método de pago</span>
            <span>{METODO_LABEL[pago.metodoPago] ?? pago.metodoPago}</span>
          </div>
          {pago.referencia && (
            <div className="flex justify-between border-b border-slate-100 py-2">
              <span className="text-slate-500">Referencia</span>
              <span>{pago.referencia}</span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-slate-500">Fecha de pago</span>
            <span>{fecha(pago.fechaPago)}</span>
          </div>
        </div>

        {/* Totales */}
        <div className="mt-2 space-y-1 border-t border-slate-300 pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Saldo pendiente</span>
            <span className={Number(pago.saldo) > 0 ? "text-amber-600" : ""}>
              {soles(pago.saldo)}
            </span>
          </div>
          <div className="flex items-center justify-between text-base font-bold">
            <span>Total pagado</span>
            <span>{soles(pago.monto)}</span>
          </div>
        </div>

        <p className="mt-8 border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-400">
          Documento interno sin valor tributario. No constituye comprobante de pago
          electrónico SUNAT.
        </p>
      </div>
    </div>
  );
}
