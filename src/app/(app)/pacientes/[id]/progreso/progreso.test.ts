import { test } from "node:test";
import assert from "node:assert/strict";
import { SECCIONES_DEFECTO, type SeccionInforme } from "../informes/informe";
import {
  MAX_PUNTOS,
  compararInformes,
  logroDe,
  resumirInforme,
  serieProgreso,
} from "./progreso";

/** Sección de prueba con los valores dados, un ítem por valor. */
function seccion(
  id: string,
  valores: (("EI" | "EP" | "LE") | null)[],
): SeccionInforme {
  return {
    id,
    titulo: id.toUpperCase(),
    items: valores.map((valor, i) => ({
      id: `${id}_${i}`,
      label: `Ítem ${i}`,
      valor,
    })),
  };
}

test("logroDe resume la escala ordinal en 0–100", () => {
  assert.equal(logroDe({ EI: 0, EP: 0, LE: 0 }), null);
  assert.equal(logroDe({ EI: 3, EP: 0, LE: 0 }), 0);
  assert.equal(logroDe({ EI: 0, EP: 4, LE: 0 }), 50);
  assert.equal(logroDe({ EI: 0, EP: 0, LE: 2 }), 100);
  assert.equal(logroDe({ EI: 1, EP: 1, LE: 1 }), 50);
  // 1·0 + 0·1 + 2·2 = 4 sobre 3 ítems × 2 = 6 → 66.67 → 67
  assert.equal(logroDe({ EI: 1, EP: 0, LE: 2 }), 67);
});

test("los ítems sin calificar no cuentan como cero", () => {
  const { general } = resumirInforme([seccion("a", ["LE", "LE", null, null])]);

  assert.equal(general.logro, 100, "el logro se calcula solo sobre calificados");
  assert.equal(general.calificados, 2);
  assert.equal(general.total, 4);
});

test("resumirInforme cuenta por área y consolida el general", () => {
  const { areas, general } = resumirInforme([
    seccion("lenguaje", ["EI", "EI"]),
    seccion("social", ["LE", "LE"]),
  ]);

  assert.deepEqual(
    areas.map((a) => [a.id, a.logro]),
    [
      ["lenguaje", 0],
      ["social", 100],
    ],
  );
  assert.deepEqual(general.conteo, { EI: 2, EP: 0, LE: 2 });
  assert.equal(general.logro, 50);
});

test("serieProgreso ordena del informe más antiguo al más reciente", () => {
  const serie = serieProgreso([
    { id: "b", fecha: new Date("2026-06-01"), secciones: [] },
    { id: "a", fecha: new Date("2026-03-01"), secciones: [] },
    { id: "c", fecha: new Date("2026-09-01"), secciones: [] },
  ]);

  assert.deepEqual(
    serie.map((p) => p.informeId),
    ["a", "b", "c"],
  );
});

test("serieProgreso conserva los últimos MAX_PUNTOS informes", () => {
  const informes = Array.from({ length: MAX_PUNTOS + 3 }, (_, i) => ({
    id: `inf_${i}`,
    fecha: new Date(2026, i, 1),
    secciones: [],
  }));

  const serie = serieProgreso(informes);

  assert.equal(serie.length, MAX_PUNTOS);
  assert.equal(serie[0].informeId, "inf_3");
  assert.equal(serie.at(-1)?.informeId, `inf_${MAX_PUNTOS + 2}`);
});

test("serieProgreso normaliza el Json crudo del informe", () => {
  const [punto] = serieProgreso([
    { id: "a", fecha: new Date("2026-03-01"), secciones: "corrupto" },
  ]);

  // normalizarSecciones repone la plantilla completa, sin calificaciones.
  assert.equal(punto.areas.length, SECCIONES_DEFECTO.length);
  assert.equal(punto.general.calificados, 0);
  assert.equal(punto.general.logro, null);
});

test("compararInformes clasifica cada ítem contra el informe anterior", () => {
  const [area] = compararInformes(
    [seccion("a", ["EI", "EP", "LE", null])],
    [seccion("a", ["EP", "EP", "EI", "LE"])],
  );

  assert.deepEqual(
    area.items.map((i) => i.estado),
    ["mejora", "igual", "retroceso", "sin_dato"],
  );
  assert.equal(area.mejoras, 1);
  assert.equal(area.iguales, 1);
  assert.equal(area.retrocesos, 1);
});

test("compararInformes empareja por id, no por texto ni por posición", () => {
  const anterior: SeccionInforme[] = [
    {
      id: "a",
      titulo: "A",
      items: [
        { id: "uno", label: "Texto viejo", valor: "EI" },
        { id: "dos", label: "Otro", valor: "EP" },
      ],
    },
  ];
  const actual: SeccionInforme[] = [
    {
      id: "a",
      titulo: "A",
      items: [
        { id: "dos", label: "Otro", valor: "LE" },
        { id: "uno", label: "Texto reescrito", valor: "LE" },
      ],
    },
  ];

  const [area] = compararInformes(anterior, actual);

  assert.deepEqual(
    area.items.map((i) => [i.id, i.estado]),
    [
      ["dos", "mejora"],
      ["uno", "mejora"],
    ],
  );
  // El texto lo manda el informe actual.
  assert.equal(area.items[1].label, "Texto reescrito");
});

test("compararInformes marca los ítems agregados y los retirados", () => {
  const [area] = compararInformes(
    [seccion("a", ["EI", "LE"])],
    [
      {
        id: "a",
        titulo: "A",
        items: [
          { id: "a_0", label: "Ítem 0", valor: "EP" },
          { id: "nuevo_x", label: "Agregado a mano", valor: "EP" },
        ],
      },
    ],
  );

  assert.deepEqual(
    area.items.map((i) => [i.id, i.estado]),
    [
      ["a_0", "mejora"],
      ["nuevo_x", "nuevo"],
      ["a_1", "retirado"],
    ],
  );
  // Un ítem nuevo o retirado no es progreso ni retroceso.
  assert.equal(area.mejoras, 1);
  assert.equal(area.retrocesos, 0);
});

test("compararInformes tolera un área que no existía en el informe anterior", () => {
  const [area] = compararInformes([], [seccion("social", ["LE"])]);

  assert.equal(area.items[0].estado, "nuevo");
  assert.equal(area.mejoras, 0);
});
