// Reporte de pagos en Excel (.xlsx): hoja "Pagos" y hoja "Resumen por método".
// Sin "server-only" para poder probarlo con node:test; solo lo usa la ruta
// /pagos/exportar, que corre en el servidor.
import writeExcelFile, {
  getSheetData,
  type Column,
  type Row,
} from "write-excel-file/node";
import type { ConceptoPago, MetodoPago } from "@prisma/client";
import { nombreCompleto } from "@/lib/utils";
import { CONCEPTO_LABEL, METODO_LABEL } from "./etiquetas";

export type PagoExcel = {
  numeroRecibo: string;
  fechaPago: Date;
  concepto: ConceptoPago;
  metodoPago: MetodoPago;
  monto: number;
  saldo: number;
  paciente: {
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    dni: string | null;
  };
};

export type FilaResumen = { metodo: MetodoPago; cantidad: number; total: number };

const MONEDA = "#,##0.00";

const LIMA_PARTES = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * La librería escribe las fechas en UTC: se devuelve un Date cuyos componentes
 * UTC son la fecha y hora de Lima, para que Excel muestre la hora del pago en
 * Perú (un pago a las 20:00 no puede pasar al día siguiente).
 */
export function fechaHoraLimaParaExcel(d: Date): Date {
  const p = Object.fromEntries(
    LIMA_PARTES.formatToParts(d).map((x) => [x.type, x.value]),
  );
  return new Date(
    Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second),
  );
}

/** Suma montos en céntimos para no acumular errores de coma flotante. */
function sumar(montos: number[]): number {
  return montos.reduce((s, m) => s + Math.round(m * 100), 0) / 100;
}

/** Cantidad y total por método, en el orden del enum; omite los que no tienen pagos. */
export function resumenPorMetodo(
  pagos: { metodoPago: MetodoPago; monto: number }[],
): FilaResumen[] {
  return (Object.keys(METODO_LABEL) as MetodoPago[]).flatMap((metodo) => {
    const delMetodo = pagos.filter((p) => p.metodoPago === metodo);
    return delMetodo.length === 0
      ? []
      : [{ metodo, cantidad: delMetodo.length, total: sumar(delMetodo.map((p) => p.monto)) }];
  });
}

/**
 * "pagos-SJL-2026-09.xlsx". Solo letras, números, "_" y "-": el periodo viene
 * de la URL y no puede meter comillas ni saltos de línea en la cabecera.
 */
export function nombreArchivo(sede: string, periodo: string): string {
  const limpio = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quita tildes: "Ñaña" → "Nana"
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return `pagos-${limpio(sede) || "sede"}-${limpio(periodo) || "periodo"}.xlsx`;
}

const negrita = (value: string) => ({ value, fontWeight: "bold" as const });

const COLUMNAS_PAGOS: Column<PagoExcel>[] = [
  { header: negrita("N.º recibo"), cell: (p) => ({ value: p.numeroRecibo }), width: 14 },
  {
    header: negrita("Fecha"),
    // Solo la fecha: registrarPago guarda el pago a mediodía, la hora no es real.
    cell: (p) => ({
      value: fechaHoraLimaParaExcel(p.fechaPago),
      format: "dd/mm/yyyy",
    }),
    width: 12,
  },
  { header: negrita("Paciente"), cell: (p) => ({ value: nombreCompleto(p.paciente) }), width: 34 },
  // "@" = texto: Excel no le quita los ceros iniciales al DNI. El tipo va
  // explícito porque con DNI vacío la librería no puede deducirlo y rechaza "@".
  {
    header: negrita("DNI"),
    cell: (p) => ({ value: p.paciente.dni ?? "", type: String, format: "@" }),
    width: 12,
  },
  { header: negrita("Concepto"), cell: (p) => ({ value: CONCEPTO_LABEL[p.concepto] }), width: 20 },
  { header: negrita("Método"), cell: (p) => ({ value: METODO_LABEL[p.metodoPago] }), width: 14 },
  { header: negrita("Monto"), cell: (p) => ({ value: p.monto, format: MONEDA }), width: 12 },
  { header: negrita("Saldo"), cell: (p) => ({ value: p.saldo, format: MONEDA }), width: 12 },
];

const COLUMNAS_RESUMEN: Column<FilaResumen>[] = [
  { header: negrita("Método"), cell: (r) => ({ value: METODO_LABEL[r.metodo] }), width: 16 },
  { header: negrita("Cantidad"), cell: (r) => ({ value: r.cantidad }), width: 10 },
  { header: negrita("Total"), cell: (r) => ({ value: r.total, format: MONEDA }), width: 14 },
];

const totalMoneda = (value: number) => ({ value, format: MONEDA, fontWeight: "bold" as const });

export async function generarExcelPagos(pagos: PagoExcel[]): Promise<Buffer> {
  const filaTotal: Row = [
    negrita("Total"),
    null,
    null,
    null,
    null,
    null,
    totalMoneda(sumar(pagos.map((p) => p.monto))),
    totalMoneda(sumar(pagos.map((p) => p.saldo))),
  ];

  const resumen = resumenPorMetodo(pagos);
  const filaTotalResumen: Row = [
    negrita("Total"),
    { value: pagos.length, fontWeight: "bold" },
    totalMoneda(sumar(resumen.map((r) => r.total))),
  ];

  return writeExcelFile([
    {
      sheet: "Pagos",
      data: [...getSheetData(pagos, COLUMNAS_PAGOS), filaTotal],
      columns: COLUMNAS_PAGOS,
    },
    {
      sheet: "Resumen por método",
      data: [...getSheetData(resumen, COLUMNAS_RESUMEN), filaTotalResumen],
      columns: COLUMNAS_RESUMEN,
    },
  ]).toBuffer();
}
