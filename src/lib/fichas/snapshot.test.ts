import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarPlantilla } from "./plantilla";
import { huerfanos } from "./valores";
import { estaDesactualizada, reconciliar, snapshotDe } from "./snapshot";

const v1 = normalizarPlantilla({
  escalas: [{ id: "IPL", valores: ["I", "P", "L"], labels: {} }],
  secciones: [
    {
      id: "s",
      titulo: "Área",
      escalaId: "IPL",
      grupos: [
        {
          id: "g",
          campos: [
            { tipo: "texto", id: "dx", label: "Diagnóstico" },
            { tipo: "texto", id: "retirado", label: "Campo que se quitará" },
            {
              tipo: "checklist",
              id: "chk",
              items: [
                { id: "i1", label: "Contacto visual" },
                { id: "i2", label: "Mirada sostenida" },
              ],
            },
          ],
        },
      ],
    },
  ],
});

// v2: se quitó "retirado", se agregó "nuevo" y un ítem más al checklist.
const v2 = normalizarPlantilla({
  escalas: [{ id: "IPL", valores: ["I", "P", "L"], labels: {} }],
  secciones: [
    {
      id: "s",
      titulo: "Área",
      escalaId: "IPL",
      grupos: [
        {
          id: "g",
          campos: [
            { tipo: "texto", id: "dx", label: "Diagnóstico (Dx)" },
            { tipo: "texto", id: "nuevo", label: "Campo nuevo" },
            {
              tipo: "checklist",
              id: "chk",
              items: [
                { id: "i1", label: "Contacto visual" },
                { id: "i2", label: "Mirada sostenida" },
                { id: "i3", label: "Ítem agregado después" },
              ],
            },
          ],
        },
      ],
    },
  ],
});

test("el snapshot es una copia independiente de la plantilla", () => {
  const copia = snapshotDe(v1);
  assert.deepEqual(copia, v1);
  copia.secciones[0].titulo = "Cambiado";
  assert.equal(v1.secciones[0].titulo, "Área", "mutar la copia no debe tocar el original");
});

test("una ficha queda desactualizada solo si su versión es anterior", () => {
  assert.equal(estaDesactualizada(3, 5), true);
  assert.equal(estaDesactualizada(5, 5), false);
  assert.equal(estaDesactualizada(6, 5), false);
  // Versión 0 = el centro nunca guardó plantilla propia: no se avisa.
  assert.equal(estaDesactualizada(0, 5), false);
  assert.equal(estaDesactualizada(3, 0), false);
});

test("reconciliar conserva lo que coincide, vacía lo nuevo y no pierde lo retirado", () => {
  const registrado = {
    dx: { t: "texto", v: "TEL mixto" },
    retirado: { t: "texto", v: "dato que ya no tiene campo" },
    chk: { t: "checklist", items: { i1: { valor: "L" }, i2: { valor: "P" } } },
  };

  const { estructura, valores } = reconciliar(registrado, v2);

  // La estructura pasa a ser la vigente.
  assert.equal(estructura.secciones[0].grupos[0].campos[0].label, "Diagnóstico (Dx)");
  // Lo que coincide por id conserva su valor.
  assert.deepEqual(valores.dx, { t: "texto", v: "TEL mixto" });
  assert.deepEqual(valores.chk, {
    t: "checklist",
    items: { i1: { valor: "L" }, i2: { valor: "P" } },
  });
  // El ítem agregado después entra sin calificar.
  assert.equal("i3" in (valores.chk as { items: object }).items, false);
  // El campo nuevo queda vacío.
  assert.equal(valores.nuevo, undefined);
  // Y lo retirado NO se borra: queda como huérfano.
  assert.deepEqual(valores.retirado, { t: "texto", v: "dato que ya no tiene campo" });
  assert.deepEqual(huerfanos(valores, v2).map(([id]) => id), ["retirado"]);
});
