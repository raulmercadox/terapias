import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS_FICHA } from "../../../app/(app)/pacientes/[id]/evaluaciones/ficha";
import { SECCIONES_DEFECTO } from "../../../app/(app)/pacientes/[id]/informes/informe";
import { camposDe, idsDuplicados, normalizarPlantilla } from "../plantilla";
import type { Plantilla } from "../tipos";
import { PSICOLOGICA } from "./psicologica";
import { FISICA } from "./fisica";

/** Todos los ids de ítem de los checklists de una plantilla. */
function idsDeItems(plantilla: Plantilla): string[] {
  return camposDe(plantilla).flatMap((c) =>
    c.tipo === "checklist" ? c.items.map((i) => i.id) : [],
  );
}

const TODAS: [string, Plantilla][] = [
  ["psicologica/HISTORIA", PSICOLOGICA.HISTORIA],
  ["psicologica/EVALUACION", PSICOLOGICA.EVALUACION],
  ["psicologica/INFORME", PSICOLOGICA.INFORME],
  ["fisica/HISTORIA", FISICA.HISTORIA],
  ["fisica/EVALUACION", FISICA.EVALUACION],
  ["fisica/INFORME", FISICA.INFORME],
];

test("las plantillas base sobreviven al saneador sin perder nada", () => {
  for (const [nombre, plantilla] of TODAS) {
    const saneada = normalizarPlantilla(plantilla);
    assert.equal(
      saneada.secciones.length,
      plantilla.secciones.length,
      `${nombre}: se perdieron secciones al sanear`,
    );
    assert.equal(
      camposDe(saneada).length,
      camposDe(plantilla).length,
      `${nombre}: se perdieron campos al sanear`,
    );
    assert.equal(
      idsDeItems(saneada).length,
      idsDeItems(plantilla).length,
      `${nombre}: se perdieron ítems al sanear`,
    );
  }
});

test("ningún id se repite dentro de una plantilla", () => {
  for (const [nombre, plantilla] of TODAS) {
    assert.deepEqual(idsDuplicados(plantilla), [], `${nombre}: ids repetidos`);
  }
});

test("cada checklist resuelve su escala", () => {
  for (const [nombre, plantilla] of TODAS) {
    for (const seccion of plantilla.secciones) {
      for (const grupo of seccion.grupos) {
        for (const campo of grupo.campos) {
          if (campo.tipo !== "checklist") continue;
          const id = campo.escalaId ?? seccion.escalaId;
          assert.ok(id, `${nombre}: el checklist ${campo.id} no tiene escala`);
          assert.ok(
            plantilla.escalas.some((e) => e.id === id),
            `${nombre}: la escala ${id} del checklist ${campo.id} no está declarada`,
          );
        }
      }
    }
  }
});

test("toda escala declarada tiene etiqueta para cada valor", () => {
  for (const [nombre, plantilla] of TODAS) {
    for (const escala of plantilla.escalas) {
      for (const valor of escala.valores) {
        assert.ok(escala.labels[valor], `${nombre}: la escala ${escala.id} no etiqueta ${valor}`);
      }
    }
  }
});

/* ── Paridad con los catálogos que reemplaza ───────────── */
// La analítica de progreso compara los informes por id de ítem, así que la
// plantilla psicológica debe traer EXACTAMENTE los mismos ids que el catálogo
// fijo del que sale. Si alguien renombra un id al editar estos archivos, este
// test lo detiene antes de romper la serie histórica de los pacientes.

test("la evaluación psicológica conserva los ids de AREAS_FICHA", () => {
  const originales = AREAS_FICHA.flatMap((a) =>
    a.grupos.flatMap((g) => g.items.map((i) => i.id)),
  ).sort();
  const migrados = idsDeItems(PSICOLOGICA.EVALUACION).sort();
  assert.deepEqual(migrados, originales);
});

test("el informe psicológico conserva los ids de SECCIONES_DEFECTO", () => {
  const originales = SECCIONES_DEFECTO.flatMap((s) => s.items.map((i) => i.id)).sort();
  const migrados = idsDeItems(PSICOLOGICA.INFORME).sort();
  assert.deepEqual(migrados, originales);
});

test("el informe psicológico conserva los textos de los ítems", () => {
  const original = new Map(
    SECCIONES_DEFECTO.flatMap((s) => s.items.map((i) => [i.id, i.label] as const)),
  );
  for (const campo of camposDe(PSICOLOGICA.INFORME)) {
    if (campo.tipo !== "checklist") continue;
    for (const item of campo.items) {
      assert.equal(item.label, original.get(item.id), `cambió el texto de ${item.id}`);
    }
  }
});

test("la evaluación psicológica conserva los textos y el orden de las áreas", () => {
  const original = new Map(
    AREAS_FICHA.flatMap((a) => a.grupos.flatMap((g) => g.items.map((i) => [i.id, i.label] as const))),
  );
  for (const campo of camposDe(PSICOLOGICA.EVALUACION)) {
    if (campo.tipo !== "checklist") continue;
    for (const item of campo.items) {
      assert.equal(item.label, original.get(item.id), `cambió el texto de ${item.id}`);
    }
  }
  // Las cinco áreas del formato impreso siguen estando, en su orden.
  const seccionesArea = PSICOLOGICA.EVALUACION.secciones
    .filter((s) => s.grupos.some((g) => g.campos.some((c) => c.tipo === "checklist")))
    .map((s) => s.id);
  assert.deepEqual(seccionesArea, AREAS_FICHA.map((a) => a.id));
});

test("la plantilla física no arrastra terminología psicológica", () => {
  const texto = JSON.stringify(FISICA).toLowerCase();
  for (const palabra of ["ecolalia", "esfínteres", "onomatopéyicos", "kinder", "apoderado"]) {
    assert.ok(!texto.includes(palabra), `la plantilla física menciona "${palabra}"`);
  }
});
