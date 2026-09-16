import { test } from "node:test";
import assert from "node:assert/strict";
import {
  camposDe,
  conObservacion,
  escalaDe,
  grupoVisible,
  idsDuplicados,
  normalizarPlantilla,
  plantillaVacia,
} from "./plantilla";
import type { Grupo, Plantilla, ValoresFicha } from "./tipos";

const IPL = { id: "IPL", valores: ["I", "P", "L"], labels: { I: "Inicio", P: "Proceso", L: "Logrado" } };

const base: Plantilla = normalizarPlantilla({
  formato: 1,
  escalas: [IPL],
  secciones: [
    {
      id: "datos",
      titulo: "Datos generales",
      grupos: [
        {
          id: "g1",
          campos: [
            { tipo: "texto", id: "lugarNacimiento", label: "Lugar de nacimiento" },
            { tipo: "parrafo", id: "observaciones", label: "Observaciones" },
          ],
        },
      ],
    },
    {
      id: "conductual",
      titulo: "Área conductual",
      escalaId: "IPL",
      conObservacion: true,
      grupos: [
        {
          id: "mirada",
          titulo: "Fijación de mirada",
          campos: [
            {
              tipo: "checklist",
              id: "chk_mirada",
              items: [
                { id: "cond_contacto_visual", label: "Contacto visual" },
                { id: "cond_respuesta_nombre", label: "Respuesta a su nombre" },
              ],
            },
          ],
        },
      ],
    },
  ],
});

test("normalizarPlantilla conserva lo válido y descarta la basura", () => {
  assert.equal(base.secciones.length, 2);
  assert.equal(camposDe(base).length, 3);
  assert.equal(base.escalas[0].labels.P, "Proceso");

  const sucia = normalizarPlantilla({
    escalas: [{ id: "X" }, null, { id: "OK", valores: ["A"] }],
    secciones: [
      { id: "sin-titulo", grupos: [] },
      { titulo: "sin id", grupos: [] },
      // Sección válida pero con un campo inválido y otro válido.
      {
        id: "s",
        titulo: "S",
        grupos: [{ id: "g", campos: [{ tipo: "inventado", id: "x", label: "X" }, { tipo: "texto", id: "ok", label: "Ok" }] }],
      },
    ],
  });
  assert.equal(sucia.escalas.length, 1); // la escala sin valores se descarta
  assert.equal(sucia.escalas[0].labels.A, "A"); // sin labels, el valor es su propia etiqueta
  assert.equal(sucia.secciones.length, 1);
  assert.deepEqual(camposDe(sucia).map((c) => c.id), ["ok"]);
});

test("una entrada que no es objeto da una plantilla vacía, no una excepción", () => {
  for (const entrada of [null, undefined, 42, "x", []]) {
    assert.deepEqual(normalizarPlantilla(entrada), plantillaVacia());
  }
});

test("un grupo sin campos válidos no sobrevive", () => {
  const p = normalizarPlantilla({
    secciones: [{ id: "s", titulo: "S", grupos: [{ id: "vacio", campos: [] }] }],
  });
  assert.equal(p.secciones.length, 0);
});

test("idsDuplicados mira también los ítems de los checklists", () => {
  assert.deepEqual(idsDuplicados(base), []);
  const repetido = normalizarPlantilla({
    secciones: [
      {
        id: "s",
        titulo: "S",
        grupos: [
          {
            id: "g",
            campos: [
              { tipo: "texto", id: "dolor", label: "Dolor" },
              { tipo: "checklist", id: "chk", items: [{ id: "dolor", label: "Dolor" }] },
            ],
          },
        ],
      },
    ],
  });
  assert.deepEqual(idsDuplicados(repetido), ["dolor"]);
});

/* ── visibleSi: reemplaza al viejo grupoAplica de la ficha ── */

const grupoVerbal: Grupo = {
  id: "verbal",
  campos: [{ tipo: "texto", id: "x", label: "X" }],
  visibleSi: { campoId: "modalidad", valores: ["VERBAL"] },
};
const grupoSiempre: Grupo = { id: "libre", campos: [{ tipo: "texto", id: "y", label: "Y" }] };
const conModalidad = (v: string): ValoresFicha => ({ modalidad: { t: "opciones", v: [v] } });

test("un grupo sin condición se ve siempre", () => {
  assert.equal(grupoVisible(grupoSiempre, {}), true);
  assert.equal(grupoVisible(grupoSiempre, conModalidad("NO_VERBAL")), true);
});

test("el grupo condicionado se ve solo con su valor", () => {
  assert.equal(grupoVisible(grupoVerbal, conModalidad("VERBAL")), true);
  assert.equal(grupoVisible(grupoVerbal, conModalidad("NO_VERBAL")), false);
});

test("sin valor elegido todavía, el grupo condicionado se ve igual", () => {
  // Reproduce el comportamiento del viejo grupoAplica con modalidad null: hay
  // que poder llenar cualquiera de las dos hasta que se elija una.
  assert.equal(grupoVisible(grupoVerbal, {}), true);
  assert.equal(grupoVisible(grupoVerbal, { modalidad: { t: "opciones", v: [] } }), true);
  assert.equal(grupoVisible(grupoVerbal, { modalidad: { t: "texto", v: "" } }), true);
});

/* ── Herencia de escala y observación ──────────────────── */

test("el checklist hereda la escala y la observación de su sección", () => {
  const seccion = base.secciones[1];
  const campo = seccion.grupos[0].campos[0];
  assert.equal(escalaDe(base, seccion, campo)?.id, "IPL");
  assert.equal(conObservacion(seccion, campo), true);
});

test("el campo puede sobrescribir lo que hereda de la sección", () => {
  const p = normalizarPlantilla({
    escalas: [IPL, { id: "SINO", valores: ["SI", "NO"] }],
    secciones: [
      {
        id: "s",
        titulo: "S",
        escalaId: "IPL",
        conObservacion: true,
        grupos: [
          {
            id: "g",
            campos: [
              { tipo: "checklist", id: "propia", escalaId: "SINO", conObservacion: false, items: [{ id: "i", label: "I" }] },
            ],
          },
        ],
      },
    ],
  });
  const seccion = p.secciones[0];
  const campo = seccion.grupos[0].campos[0];
  assert.equal(escalaDe(p, seccion, campo)?.id, "SINO");
  assert.equal(conObservacion(seccion, campo), false);
});

test("una escala que no existe no revienta: devuelve null", () => {
  const p = normalizarPlantilla({
    secciones: [
      { id: "s", titulo: "S", escalaId: "FANTASMA", grupos: [{ id: "g", campos: [{ tipo: "checklist", id: "c", items: [{ id: "i", label: "I" }] }] }] },
    ],
  });
  assert.equal(escalaDe(p, p.secciones[0], p.secciones[0].grupos[0].campos[0]), null);
});
