import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describirRegla,
  diasDeGracia,
  estadoCobro,
  evaluarCobro,
  fechaLimitePago,
  mensajeWhatsAppCobro,
  textoCobro,
  type ReglaGracia,
} from "./cobranza";

const MITAD: ReglaGracia = { tipo: "PORCENTAJE", valor: 50, diasAviso: 7 };
const DIEZ_DIAS: ReglaGracia = { tipo: "DIAS", valor: 10, diasAviso: 7 };
const estado = (limiteISO: string, hoy: string, saldo = 100) =>
  estadoCobro({ saldo, limiteISO, hoy, diasAviso: 7 });

// Ejemplo del cliente: 50 % y 30 días entre la primera y la última sesión →
// el día 16 (contando la primera sesión como día 1) ya está vencido.
test("50 % de 30 días: se puede pagar hasta el día 15 y el 16 ya está vencido", () => {
  assert.equal(diasDeGracia(MITAD, "2026-09-01", "2026-10-01"), 15);
  const limite = fechaLimitePago(MITAD, "2026-09-01", "2026-10-01");
  assert.equal(limite, "2026-09-15");
  assert.equal(estado(limite, "2026-09-15"), "por-vencer");
  assert.equal(estado(limite, "2026-09-16"), "vencido");
});

test("días fijos: 10 días desde la primera sesión, sin importar la duración", () => {
  assert.equal(fechaLimitePago(DIEZ_DIAS, "2026-09-01", "2026-12-01"), "2026-09-10");
  assert.equal(estado("2026-09-10", "2026-09-11"), "vencido");
});

test("el porcentaje se redondea hacia arriba", () => {
  assert.equal(diasDeGracia(MITAD, "2026-09-01", "2026-09-26"), 13); // 12,5 → 13
  assert.equal(diasDeGracia({ ...MITAD, valor: 33 }, "2026-09-01", "2026-10-01"), 10); // 9,9 → 10
});

test("un paquete de una sola sesión vence el mismo día que empieza", () => {
  assert.equal(diasDeGracia(MITAD, "2026-09-01", "2026-09-01"), 0);
  assert.equal(fechaLimitePago(MITAD, "2026-09-01", "2026-09-01"), "2026-08-31");
});

test("ventana de aviso: desde 7 días antes hasta el día límite", () => {
  assert.equal(estado("2026-09-15", "2026-09-07"), null);
  assert.equal(estado("2026-09-15", "2026-09-08"), "por-vencer");
  assert.equal(estado("2026-09-15", "2026-09-15"), "por-vencer");
  assert.equal(estado("2026-09-15", "2026-09-16"), "vencido");
});

test("evaluarCobro calcula el saldo sin errores de coma flotante", () => {
  const paquete = { precio: 480.3, pagado: 480.2, fechaInicio: "2026-09-01", fechaFin: "2026-10-01" };
  assert.deepEqual(evaluarCobro(paquete, MITAD, "2026-09-16"), {
    saldo: 0.1,
    limiteISO: "2026-09-15",
    estado: "vencido",
  });
  assert.equal(evaluarCobro({ ...paquete, pagado: 480.3 }, MITAD, "2026-09-16").estado, null);
  assert.deepEqual(evaluarCobro({ ...paquete, fechaInicio: null }, MITAD, "2026-09-16"), {
    saldo: 0.1,
    limiteISO: null,
    estado: null,
  });
});

test("sin saldo pendiente no hay nada que cobrar", () => {
  assert.equal(estado("2026-09-15", "2026-10-01", 0), null);
  assert.equal(estado("2026-09-15", "2026-10-01", -20), null);
});

test("textos del aviso y de la regla", () => {
  assert.equal(textoCobro("vencido", "2026-09-15", "2026-09-16"), "Venció el 15/09 · 1 día de atraso");
  assert.equal(textoCobro("vencido", "2026-09-15", "2026-09-18"), "Venció el 15/09 · 3 días de atraso");
  assert.equal(textoCobro("por-vencer", "2026-09-15", "2026-09-15"), "Vence hoy");
  assert.equal(textoCobro("por-vencer", "2026-09-15", "2026-09-14"), "Vence mañana");
  assert.equal(textoCobro("por-vencer", "2026-09-15", "2026-09-10"), "Vence el 15/09 · en 5 días");
  assert.equal(describirRegla(MITAD), "50 % de la duración de la terapia");
  assert.equal(describirRegla({ tipo: "DIAS", valor: 1 }), "1 día desde la primera sesión");
});

// Multitenant: el saludo lleva el nombre del centro, no una marca fija.
test("mensaje de WhatsApp con el centro, el saldo y la fecha límite", () => {
  const m = mensajeWhatsAppCobro({
    centro: "Centro de Terapias Arcoíris",
    sede: "SJL",
    paciente: "Camila Torres",
    saldo: 100,
    limiteISO: "2026-09-15",
    estado: "vencido",
  });
  assert.match(m, /de Centro de Terapias Arcoíris \(sede SJL\)/);
  assert.match(m, /Camila Torres/);
  assert.match(m, /venció el 15\/09\/2026/);
  assert.match(m, /100\.00/);
});
