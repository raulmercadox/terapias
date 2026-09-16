import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fechaHoraLimaParaExcel,
  generarExcelPagos,
  nombreArchivo,
  resumenPorMetodo,
  type PagoExcel,
} from "./excel";

test("la fecha del pago se escribe con la hora de Lima, sin pasar al día siguiente", () => {
  // 01:00 UTC del 11/09 = 20:00 del 10/09 en Lima.
  const d = fechaHoraLimaParaExcel(new Date("2026-09-11T01:00:00.000Z"));
  assert.equal(d.toISOString(), "2026-09-10T20:00:00.000Z");
});

test("el resumen agrupa por método en orden, sin errores de coma flotante", () => {
  const resumen = resumenPorMetodo([
    { metodoPago: "YAPE", monto: 0.1 },
    { metodoPago: "EFECTIVO", monto: 50 },
    { metodoPago: "YAPE", monto: 0.2 },
  ]);
  assert.deepEqual(resumen, [
    { metodo: "EFECTIVO", cantidad: 1, total: 50 },
    { metodo: "YAPE", cantidad: 2, total: 0.3 },
  ]);
  assert.deepEqual(resumenPorMetodo([]), []);
});

test("el nombre del archivo solo lleva caracteres seguros", () => {
  assert.equal(nombreArchivo("SJL", "2026-09"), "pagos-SJL-2026-09.xlsx");
  assert.equal(
    nombreArchivo("San Juan de Lurigancho", "2026-09-01_2026-09-13"),
    "pagos-San-Juan-de-Lurigancho-2026-09-01_2026-09-13.xlsx",
  );
  assert.equal(nombreArchivo("Miraflores", 'x"\r\nSet-Cookie: a'), "pagos-Miraflores-x-Set-Cookie-a.xlsx");
  assert.equal(nombreArchivo("Ñaña", ""), "pagos-Nana-periodo.xlsx");
});

test("genera un .xlsx (archivo ZIP) con pagos y también sin pagos", async () => {
  const pago: PagoExcel = {
    numeroRecibo: "SJL-000001",
    fechaPago: new Date("2026-09-10T15:30:00.000Z"),
    concepto: "PAQUETE_SESIONES",
    metodoPago: "YAPE",
    monto: 480,
    saldo: 0,
    paciente: { nombres: "Ana", apellidoPaterno: "Pérez", apellidoMaterno: null, dni: "01234567" },
  };
  // Un paciente sin DNI dejaba la celda "@" sin tipo y la librería lanzaba error.
  const sinDni: PagoExcel = { ...pago, paciente: { ...pago.paciente, dni: null } };
  for (const pagos of [[pago], [sinDni], []]) {
    const buffer = await generarExcelPagos(pagos);
    assert.equal(buffer.subarray(0, 2).toString(), "PK");
  }
});
