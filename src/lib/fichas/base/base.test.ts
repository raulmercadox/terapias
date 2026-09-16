import { test } from "node:test";
import assert from "node:assert/strict";
// Ids e identificadores de áreas del catálogo fijo `evaluaciones/ficha.ts`, que
// la plantilla psicológica reemplazó. Se congelan aquí como copia literal
// porque aquel archivo ya no existe y esta lista es la última defensa contra un
// renombrado accidental: la analítica de progreso compara por id de ítem.
const AREAS_ORIGINALES = [
  "conductual",
  "lenguaje",
  "cognitiva",
  "sensorial",
  "psicomotricidad",
];

const IDS_ORIGINALES = [
  // V. Área conductual
  "cond_contacto_visual", "cond_respuesta_estimulo", "cond_respuesta_nombre",
  "cond_mirada_sostenida", "cond_saluda_despide", "cond_parate_sientate",
  "cond_dame_toma", "cond_guarda_recoge", "cond_ven_vamos", "cond_lleva_dale",
  "cond_senala", "cond_solicita_pide", "cond_cambio_actividad",
  "cond_retiro_estimulo", "cond_cambio_rutina", "cond_intereses_restringidos",
  "cond_perm_mesa", "cond_perm_actividad", "cond_perm_con_estimulo",
  "cond_perm_sin_estimulo", "cond_espera_con_actividad", "cond_espera_sin_actividad",
  // VI. Área de lenguaje
  "leng_onomatopeyicos", "leng_ecolalia", "leng_contacto_visual",
  "leng_comprende_social", "leng_imitacion", "leng_comprende_indicaciones",
  "leng_asocia_imagenes",
  // VII. Área cognitiva
  "cog_numeros", "cog_vocales", "cog_colores", "cog_formas", "cog_figura_fondo",
  "cog_grande_pequeno", "cog_largo_corto", "cog_grueso_delgado", "cog_pocos_muchos",
  "cog_atencion_sostenida", "cog_atencion_espontaneo", "cog_atencion_disperso",
  // VIII. Área sensorial
  "sens_seco", "sens_humedo", "sens_suave", "sens_sonidos_fuertes", "sens_integracion",
  // IX. Psicomotricidad
  "psic_imita", "psic_equilibrio", "psic_circuito", "psic_frustra", "psic_fina",
];
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

test("la evaluación psicológica conserva los ids del catálogo original", () => {
  const migrados = idsDeItems(PSICOLOGICA.EVALUACION).sort();
  assert.deepEqual(migrados, [...IDS_ORIGINALES].sort());
});

// Ids del catálogo fijo `informes/informe.ts` (SECCIONES_DEFECTO), congelados
// aquí por el mismo motivo: son los que empareja la analítica de progreso entre
// informes sucesivos de un paciente.
const IDS_INFORME_ORIGINALES = [
  "len_comprensivo", "len_articulado", "len_narrativo", "len_tema",
  "ped_nociones_espaciales", "ped_colores", "ped_figuras", "ped_partes_cuerpo",
  "ped_motricidad_fina", "ped_motricidad_gruesa", "ped_secuencia_imagenes",
  "ped_material_concreto", "ped_sensoriales", "ped_columpio",
  "aut_lavado_manos", "aut_espera_material", "aut_sigue_indicaciones",
  "aut_sentado_lonchera", "aut_necesidades_fisiologicas", "aut_tolerancia_cambios",
  "aut_deberes_aula", "aut_juegos_reglas",
  "soc_saluda_despide", "soc_interactua", "soc_actividades_grupo",
  "soc_respeta_turnos", "soc_interes_jugar", "soc_contacto_visual",
];

test("el informe psicológico conserva los ids del catálogo original", () => {
  const migrados = idsDeItems(PSICOLOGICA.INFORME).sort();
  assert.deepEqual(migrados, [...IDS_INFORME_ORIGINALES].sort());
});

test("el informe psicológico conserva sus cuatro secciones en orden", () => {
  assert.deepEqual(
    PSICOLOGICA.INFORME.secciones.map((s) => s.id),
    ["lenguaje", "pedagogica", "autonomia", "social"],
  );
});

test("la evaluación psicológica conserva las cinco áreas en su orden", () => {
  const seccionesArea = PSICOLOGICA.EVALUACION.secciones
    .filter((s) => s.grupos.some((g) => g.campos.some((c) => c.tipo === "checklist")))
    .map((s) => s.id);
  assert.deepEqual(seccionesArea, AREAS_ORIGINALES);
});

test("la plantilla física no arrastra terminología psicológica", () => {
  const texto = JSON.stringify(FISICA).toLowerCase();
  for (const palabra of ["ecolalia", "esfínteres", "onomatopéyicos", "kinder", "apoderado"]) {
    assert.ok(!texto.includes(palabra), `la plantilla física menciona "${palabra}"`);
  }
});
