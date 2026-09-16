// Plantilla base para centros de terapia FÍSICA / rehabilitación.
//
// A diferencia de la psicológica, esta no transcribe ningún formato previo del
// sistema: arma el estándar de una evaluación kinesiológica (anamnesis, dolor
// con EVA, rangos articulares, fuerza según Daniels, marcha y funcionalidad).
// Es un punto de partida: el centro la edita en Configuración › Fichas clínicas.

import type { Escala, Plantilla, TipoFicha } from "../tipos";
import { ESCALA_EIEPLE } from "./psicologica";

/* ── Escalas propias de la rehabilitación física ──────── */

/** Escala visual analógica del dolor, 0 (sin dolor) a 10 (máximo). */
export const ESCALA_EVA: Escala = {
  id: "EVA",
  valores: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  labels: {
    "0": "Sin dolor",
    "1": "1",
    "2": "2",
    "3": "Leve",
    "4": "4",
    "5": "Moderado",
    "6": "6",
    "7": "Intenso",
    "8": "8",
    "9": "9",
    "10": "Máximo",
  },
};

/** Balance muscular manual (Daniels): 0 = sin contracción, 5 = normal. */
export const ESCALA_DANIELS: Escala = {
  id: "DANIELS",
  valores: ["0", "1", "2", "3", "4", "5"],
  labels: {
    "0": "0 · Sin contracción",
    "1": "1 · Contracción palpable",
    "2": "2 · Movimiento sin gravedad",
    "3": "3 · Vence la gravedad",
    "4": "4 · Contra resistencia parcial",
    "5": "5 · Normal",
  },
};

/** Rango de movimiento articular. */
export const ESCALA_RANGO: Escala = {
  id: "RANGO",
  valores: ["COMPLETO", "LIMITADO", "AUSENTE"],
  labels: { COMPLETO: "Completo", LIMITADO: "Limitado", AUSENTE: "Ausente" },
};

export const ESCALA_SINO_F: Escala = {
  id: "SINO",
  valores: ["SI", "NO"],
  labels: { SI: "Sí", NO: "No" },
};

/* ── Historia clínica ─────────────────────────────────── */

const HISTORIA: Plantilla = {
  formato: 1,
  escalas: [],
  numerarSecciones: true,
  secciones: [
    {
      id: "datos_generales",
      titulo: "Datos generales",
      descripcion:
        "Los datos básicos (nombres, edad, fecha de nacimiento, dirección, teléfono) se toman de la ficha del paciente.",
      grupos: [
        {
          id: "generales",
          campos: [
            { tipo: "texto", id: "ocupacion", label: "Ocupación" },
            { tipo: "texto", id: "derivadoPor", label: "Derivado por (médico / especialidad)" },
            { tipo: "texto", id: "diagnosticoMedico", label: "Diagnóstico médico" },
            { tipo: "texto", id: "lateralidad", label: "Lateralidad (diestro / zurdo)" },
          ],
        },
      ],
    },
    {
      id: "motivo",
      titulo: "Motivo de consulta",
      grupos: [
        {
          id: "motivo_g",
          campos: [
            { tipo: "parrafo", id: "motivoConsulta", label: "Motivo de consulta" },
            { tipo: "texto", id: "inicioSintomas", label: "¿Desde cuándo? (inicio de los síntomas)" },
            {
              tipo: "parrafo",
              id: "mecanismoLesion",
              label: "Mecanismo de la lesión: ¿cómo ocurrió? ¿fue progresivo o súbito?",
            },
            { tipo: "parrafo", id: "evolucionSintomas", label: "Evolución desde el inicio" },
          ],
        },
      ],
    },
    {
      id: "dolor",
      titulo: "Caracterización del dolor",
      grupos: [
        {
          id: "dolor_g",
          campos: [
            { tipo: "texto", id: "localizacionDolor", label: "Localización e irradiación" },
            {
              tipo: "opciones",
              id: "tipoDolor",
              label: "Tipo de dolor",
              multiple: true,
              opciones: [
                { valor: "PUNZANTE", label: "Punzante" },
                { valor: "QUEMANTE", label: "Quemante" },
                { valor: "OPRESIVO", label: "Opresivo" },
                { valor: "ELECTRICO", label: "Eléctrico" },
                { valor: "SORDO", label: "Sordo" },
              ],
            },
            { tipo: "texto", id: "factoresAgravantes", label: "¿Qué lo agrava?" },
            { tipo: "texto", id: "factoresAlivio", label: "¿Qué lo alivia?" },
            { tipo: "casilla", id: "dolorNocturno", label: "Presenta dolor nocturno" },
          ],
        },
      ],
    },
    {
      id: "antecedentes",
      titulo: "Antecedentes",
      grupos: [
        {
          id: "antecedentes_g",
          campos: [
            { tipo: "parrafo", id: "antecedentesPatologicos", label: "Antecedentes patológicos" },
            { tipo: "parrafo", id: "cirugiasPrevias", label: "Cirugías previas" },
            { tipo: "texto", id: "medicacionActual", label: "Medicación actual" },
            { tipo: "parrafo", id: "examenesImagen", label: "Exámenes de imagen (radiografía, RM, ecografía)" },
            { tipo: "texto", id: "alergias", label: "Alergias" },
            {
              tipo: "parrafo",
              id: "tratamientosPrevios",
              label: "Tratamientos de rehabilitación previos y su resultado",
            },
          ],
        },
      ],
    },
    {
      id: "habitos",
      titulo: "Hábitos y actividad",
      grupos: [
        {
          id: "habitos_g",
          campos: [
            { tipo: "texto", id: "actividadFisica", label: "Actividad física / deporte" },
            { tipo: "texto", id: "exigenciaLaboral", label: "Exigencia física del trabajo" },
            { tipo: "texto", id: "sueno", label: "Descanso y sueño" },
            {
              tipo: "parrafo",
              id: "limitacionesAvd",
              label: "Limitaciones en actividades de la vida diaria",
            },
          ],
        },
      ],
    },
    {
      id: "observaciones",
      titulo: "Observaciones de la entrevista",
      grupos: [
        {
          id: "observaciones_g",
          campos: [{ tipo: "parrafo", id: "observacionesEntrevista", label: "Observaciones", filas: 5 }],
        },
      ],
    },
  ],
};

/* ── Ficha de evaluación ──────────────────────────────── */

const EVALUACION: Plantilla = {
  formato: 1,
  escalas: [ESCALA_EVA, ESCALA_DANIELS, ESCALA_RANGO, ESCALA_SINO_F],
  numerarSecciones: true,
  muestraProgramaRecomendado: false,
  secciones: [
    {
      id: "inspeccion",
      titulo: "Inspección y postura",
      grupos: [
        {
          id: "inspeccion_g",
          campos: [
            { tipo: "parrafo", id: "posturaGeneral", label: "Postura general (vista anterior, lateral y posterior)" },
            { tipo: "texto", id: "edema", label: "Edema / inflamación" },
            { tipo: "texto", id: "trofismo", label: "Trofismo muscular" },
            { tipo: "texto", id: "cicatrices", label: "Cicatrices o deformidades" },
            { tipo: "texto", id: "usaAyuda", label: "Ayuda técnica que utiliza (bastón, muletas, órtesis)" },
          ],
        },
      ],
    },
    {
      id: "dolor_eva",
      titulo: "Valoración del dolor (EVA)",
      escalaId: "EVA",
      grupos: [
        {
          id: "dolor_eva_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_eva",
              conObservacion: true,
              items: [
                { id: "eva_reposo", label: "Dolor en reposo" },
                { id: "eva_movimiento", label: "Dolor en movimiento" },
                { id: "eva_nocturno", label: "Dolor nocturno" },
                { id: "eva_palpacion", label: "Dolor a la palpación" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "rango_articular",
      titulo: "Rango de movimiento articular",
      escalaId: "RANGO",
      conObservacion: true,
      numerarGrupos: true,
      grupos: [
        {
          id: "rango_superior",
          titulo: "Miembro superior",
          campos: [
            {
              tipo: "checklist",
              id: "chk_rango_superior",
              items: [
                { id: "rom_hombro_flex", label: "Hombro: flexión / extensión" },
                { id: "rom_hombro_abd", label: "Hombro: abducción / aducción" },
                { id: "rom_hombro_rot", label: "Hombro: rotación interna / externa" },
                { id: "rom_codo", label: "Codo: flexión / extensión" },
                { id: "rom_antebrazo", label: "Antebrazo: pronosupinación" },
                { id: "rom_muneca", label: "Muñeca: flexión / extensión" },
              ],
            },
          ],
        },
        {
          id: "rango_inferior",
          titulo: "Miembro inferior",
          campos: [
            {
              tipo: "checklist",
              id: "chk_rango_inferior",
              items: [
                { id: "rom_cadera_flex", label: "Cadera: flexión / extensión" },
                { id: "rom_cadera_abd", label: "Cadera: abducción / aducción" },
                { id: "rom_rodilla", label: "Rodilla: flexión / extensión" },
                { id: "rom_tobillo", label: "Tobillo: flexión dorsal / plantar" },
              ],
            },
          ],
        },
        {
          id: "rango_columna",
          titulo: "Columna",
          campos: [
            {
              tipo: "checklist",
              id: "chk_rango_columna",
              items: [
                { id: "rom_cervical", label: "Cervical: flexión, extensión, rotaciones" },
                { id: "rom_dorsal", label: "Dorsal" },
                { id: "rom_lumbar", label: "Lumbar: flexión, extensión, inclinaciones" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "fuerza",
      titulo: "Fuerza muscular (Daniels)",
      escalaId: "DANIELS",
      conObservacion: true,
      grupos: [
        {
          id: "fuerza_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_fuerza",
              items: [
                { id: "fza_hombro", label: "Cintura escapular / hombro" },
                { id: "fza_codo", label: "Flexores y extensores de codo" },
                { id: "fza_mano", label: "Prensión de la mano" },
                { id: "fza_core", label: "Musculatura abdominal y lumbar" },
                { id: "fza_cadera", label: "Musculatura de cadera" },
                { id: "fza_cuadriceps", label: "Cuádriceps" },
                { id: "fza_isquiotibiales", label: "Isquiotibiales" },
                { id: "fza_tobillo", label: "Flexores dorsales y plantares de tobillo" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "funcional",
      titulo: "Pruebas funcionales",
      escalaId: "SINO",
      grupos: [
        {
          id: "funcional_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_funcional",
              conObservacion: true,
              items: [
                { id: "fun_monopodal", label: "Mantiene apoyo monopodal 10 segundos" },
                { id: "fun_tandem", label: "Marcha en tándem" },
                { id: "fun_sentarse", label: "Sentarse y levantarse sin apoyo" },
                { id: "fun_escaleras", label: "Sube y baja escaleras de forma autónoma" },
                { id: "fun_agacharse", label: "Se agacha y recoge un objeto del suelo" },
                { id: "fun_alcanzar", label: "Alcanza objetos por encima de la cabeza" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "marcha",
      titulo: "Marcha y equilibrio",
      grupos: [
        {
          id: "marcha_g",
          campos: [
            { tipo: "parrafo", id: "patronMarcha", label: "Patrón de marcha observado" },
            { tipo: "texto", id: "distanciaMarcha", label: "Distancia que camina sin descanso" },
            { tipo: "texto", id: "equilibrio", label: "Equilibrio estático y dinámico" },
            { tipo: "casilla", id: "riesgoCaidas", label: "Presenta riesgo de caídas" },
          ],
        },
      ],
    },
    {
      id: "plan",
      titulo: "Objetivos y plan de tratamiento",
      grupos: [
        {
          id: "plan_g",
          campos: [
            { tipo: "parrafo", id: "objetivosCorto", label: "Objetivos a corto plazo" },
            { tipo: "parrafo", id: "objetivosLargo", label: "Objetivos a largo plazo" },
            { tipo: "parrafo", id: "planTratamiento", label: "Plan de tratamiento propuesto" },
            { tipo: "texto", id: "frecuenciaSugerida", label: "Frecuencia sugerida" },
          ],
        },
      ],
    },
    {
      id: "observacion_general",
      titulo: "Observación durante la evaluación",
      grupos: [
        {
          id: "observacion_general_g",
          campos: [{ tipo: "parrafo", id: "observacionGeneral", label: "Observación", filas: 5 }],
        },
      ],
    },
  ],
};

/* ── Informe de avance ────────────────────────────────── */

const INFORME: Plantilla = {
  formato: 1,
  escalas: [ESCALA_EIEPLE],
  numerarSecciones: false,
  secciones: [
    {
      id: "dolor",
      titulo: "CONTROL DEL DOLOR",
      escalaId: "EIEPLE",
      itemsAbiertos: true,
      grupos: [
        {
          id: "dolor_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_dolor",
              items: [
                { id: "inf_dolor_reposo", label: "Disminución del dolor en reposo" },
                { id: "inf_dolor_actividad", label: "Disminución del dolor durante la actividad" },
                { id: "inf_dolor_nocturno", label: "Disminución del dolor nocturno" },
                { id: "inf_dolor_analgesicos", label: "Reducción del uso de analgésicos" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "movilidad",
      titulo: "MOVILIDAD Y RANGO ARTICULAR",
      escalaId: "EIEPLE",
      itemsAbiertos: true,
      grupos: [
        {
          id: "movilidad_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_movilidad",
              items: [
                { id: "inf_rom_activo", label: "Mejora del rango de movimiento activo" },
                { id: "inf_rom_pasivo", label: "Mejora del rango de movimiento pasivo" },
                { id: "inf_flexibilidad", label: "Mejora de la flexibilidad" },
                { id: "inf_rigidez", label: "Disminución de la rigidez matutina" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "fuerza",
      titulo: "FUERZA Y RESISTENCIA",
      escalaId: "EIEPLE",
      itemsAbiertos: true,
      grupos: [
        {
          id: "fuerza_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_fuerza_inf",
              items: [
                { id: "inf_fuerza_segmento", label: "Aumento de fuerza en el segmento afectado" },
                { id: "inf_resistencia", label: "Mayor resistencia al esfuerzo" },
                { id: "inf_estabilidad", label: "Mejora de la estabilidad articular" },
                { id: "inf_control_motor", label: "Mejor control motor y coordinación" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "funcionalidad",
      titulo: "FUNCIONALIDAD Y MARCHA",
      escalaId: "EIEPLE",
      itemsAbiertos: true,
      grupos: [
        {
          id: "funcionalidad_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_funcionalidad",
              items: [
                { id: "inf_marcha", label: "Mejora del patrón de marcha" },
                { id: "inf_equilibrio", label: "Mejora del equilibrio" },
                { id: "inf_escaleras", label: "Sube y baja escaleras con autonomía" },
                { id: "inf_avd", label: "Autonomía en actividades de la vida diaria" },
                { id: "inf_ayuda_tecnica", label: "Reducción de la dependencia de ayudas técnicas" },
                { id: "inf_reintegro", label: "Reintegro a la actividad laboral o deportiva" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "adherencia",
      titulo: "ADHERENCIA AL TRATAMIENTO",
      escalaId: "EIEPLE",
      itemsAbiertos: true,
      grupos: [
        {
          id: "adherencia_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_adherencia",
              items: [
                { id: "inf_asistencia", label: "Asistencia regular a las sesiones" },
                { id: "inf_ejercicios_casa", label: "Cumple los ejercicios indicados en casa" },
                { id: "inf_recomendaciones", label: "Sigue las recomendaciones posturales y ergonómicas" },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const FISICA: Record<TipoFicha, Plantilla> = {
  HISTORIA,
  EVALUACION,
  INFORME,
};
