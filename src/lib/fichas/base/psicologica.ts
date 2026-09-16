// Plantilla base para centros de terapia PSICOLÓGICA / de lenguaje infantil.
//
// Es la transcripción 1:1 de los catálogos que antes vivían en el código
// (pacientes/[id]/evaluaciones/ficha.ts, informes/informe.ts e
// historia/historia-form.tsx). Los ids de campo e ítem se conservan LITERALES a
// propósito: la analítica de progreso compara los informes por id de ítem, así
// que cambiarlos rompería la serie histórica de cualquier paciente.
// Lo verifica base.test.ts contra los catálogos originales.

import type { Escala, Plantilla, TipoFicha } from "../tipos";

/* ── Escalas ──────────────────────────────────────────── */

export const ESCALA_IPL: Escala = {
  id: "IPL",
  valores: ["I", "P", "L"],
  labels: { I: "Inicio", P: "Proceso", L: "Logrado" },
};

export const ESCALA_SINO: Escala = {
  id: "SINO",
  valores: ["SI", "NO"],
  labels: { SI: "Sí", NO: "No" },
};

export const ESCALA_EIEPLE: Escala = {
  id: "EIEPLE",
  valores: ["EI", "EP", "LE"],
  labels: { EI: "En Inicio", EP: "En Proceso", LE: "Logro Esperado" },
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
            { tipo: "texto", id: "lugarNacimiento", label: "Lugar de nacimiento" },
            { tipo: "texto", id: "padreApoderado", label: "Padre o apoderado" },
          ],
        },
      ],
    },
    {
      id: "historia",
      titulo: "Historia",
      numerarGrupos: true,
      grupos: [
        {
          id: "familiar",
          titulo: "Historia familiar",
          campos: [
            {
              tipo: "tabla",
              id: "familiares",
              label: "Historia familiar",
              columnas: [
                { id: "parentesco", label: "Parentesco" },
                { id: "nombres", label: "Nombres" },
                { id: "edad", label: "Edad", ancho: "corto" },
                { id: "ocupacion", label: "Ocupación" },
                { id: "relacion", label: "Relación con el evaluado" },
              ],
              filasSugeridas: [
                { parentesco: "Padre" },
                { parentesco: "Madre" },
                { parentesco: "Hermano(a)" },
              ],
            },
          ],
        },
        {
          id: "pre_postnatal",
          titulo: "Historia pre - postnatal",
          campos: [
            { tipo: "parrafo", id: "historiaPrePostnatal", label: "Historia pre - postnatal" },
            {
              tipo: "parrafo",
              id: "presentacionDificultad",
              label: "¿Cómo se presentó esta dificultad? ¿Desde cuándo? ¿Quién lo detectó?",
            },
            { tipo: "parrafo", id: "signosSintomas", label: "Signos y síntomas principales" },
          ],
        },
        {
          id: "escolar",
          titulo: "Historia escolar",
          campos: [
            { tipo: "texto", id: "tempranaCentro", label: "E. Temprana: centro educativo" },
            { tipo: "texto", id: "tempranaAdaptacion", label: "E. Temprana: adaptación / dificultades" },
            { tipo: "texto", id: "kinderCentro", label: "Kinder: centro educativo" },
            { tipo: "texto", id: "kinderAdaptacion", label: "Kinder: adaptación / dificultades" },
            {
              tipo: "parrafo",
              id: "evolucionMejoria",
              label:
                "¿Cómo ha evolucionado desde que apareció por primera vez? ¿Ha notado alguna mejoría?",
            },
            { tipo: "parrafo", id: "examenesRealizados", label: "Exámenes realizados" },
            {
              tipo: "parrafo",
              id: "tratamientosRecibidos",
              label:
                "Tratamiento – terapias recibidas: ¿cuánto tiempo?, ¿en qué instituciones?, evolución del tratamiento",
            },
          ],
        },
        {
          id: "farmacologico",
          titulo: "Tratamiento farmacológico – medicación",
          campos: [
            { tipo: "texto", id: "indicacionesDoctor", label: "Indicaciones del doctor" },
            { tipo: "texto", id: "medicinasRecomendadas", label: "Medicinas recomendadas" },
            { tipo: "texto", id: "dosis", label: "Dosis" },
            { tipo: "texto", id: "tiempoInicio", label: "Tiempo de inicio" },
            {
              tipo: "parrafo",
              id: "mejoriaMedicacion",
              label: "Observaciones: ¿qué mejoría presenta el menor?",
            },
          ],
        },
      ],
    },
    {
      id: "habitos",
      titulo: "Formación de hábitos",
      grupos: [
        {
          id: "habitos_g",
          campos: [
            { tipo: "texto", id: "alimentacion", label: "Alimentación" },
            { tipo: "texto", id: "controlEsfinteres", label: "Control de esfínteres" },
            { tipo: "texto", id: "sueno", label: "Sueño" },
            { tipo: "texto", id: "autonomiaPersonal", label: "Nivel de autonomía personal" },
          ],
        },
      ],
    },
    {
      id: "actitud_padres",
      titulo: "Opinión y actitud del padre hacia el hijo",
      grupos: [
        {
          id: "actitud_g",
          campos: [
            {
              tipo: "opciones",
              id: "reaccionPadres",
              label: "Reacción de los padres",
              multiple: true,
              opciones: [
                { valor: "RECHAZO", label: "Rechazo" },
                { valor: "INDIFERENCIA", label: "Indiferencia" },
                { valor: "ACEPTACION", label: "Aceptación" },
                { valor: "PREOCUPACION", label: "Preocupación" },
                { valor: "VERGUENZA", label: "Vergüenza" },
              ],
            },
            { tipo: "parrafo", id: "reaccionDetalle", label: "Detalle de la reacción" },
            {
              tipo: "parrafo",
              id: "creencias",
              label: "Creencias sobre el problema, sentimientos de culpa, etc.",
            },
            {
              tipo: "parrafo",
              id: "cambiosCrianza",
              label:
                "Cambios: aislarlo o dejarlo con el grupo, exigirle un comportamiento similar, mayor atención, sobreprotección…",
            },
            {
              tipo: "parrafo",
              id: "usoCastigo",
              label: "Uso del castigo: ¿cómo, con qué frecuencia? Reacción del niño",
            },
            {
              tipo: "parrafo",
              id: "comportamientoApego",
              label:
                "Comportamiento del niño con los padres, hermanos, amigos, otros. Apego del niño, ¿hacia quién?",
            },
          ],
        },
      ],
    },
    {
      id: "antecedentes_familiares",
      titulo: "Antecedentes familiares",
      grupos: [
        {
          id: "antecedentes_g",
          campos: [
            {
              tipo: "parrafo",
              id: "enfermedadesFamiliares",
              label: "¿Enfermedad/condición en la familia? (SI/NO, especificar)",
            },
            { tipo: "parrafo", id: "caracterPadres", label: "Carácter de los padres. Relación de pareja" },
          ],
        },
      ],
    },
    {
      id: "observaciones_entrevista",
      titulo: "Observaciones durante la entrevista",
      grupos: [
        {
          id: "observaciones_g",
          campos: [
            { tipo: "parrafo", id: "observacionesEntrevista", label: "Observaciones", filas: 5 },
          ],
        },
      ],
    },
  ],
};

/* ── Ficha de evaluación ──────────────────────────────── */

const EVALUACION: Plantilla = {
  formato: 1,
  escalas: [ESCALA_IPL, ESCALA_SINO],
  numerarSecciones: true,
  muestraProgramaRecomendado: true,
  secciones: [
    {
      id: "datos_complementarios",
      titulo: "Datos personales complementarios",
      descripcion:
        "Los datos básicos (nombres, edad, sexo, dirección, teléfono) se toman de la ficha del paciente.",
      grupos: [
        {
          id: "complementarios",
          campos: [
            { tipo: "texto", id: "lugarNacimiento", label: "Lugar de nacimiento" },
            { tipo: "texto", id: "numeroHermanos", label: "N° de hermanos" },
            { tipo: "texto", id: "nivelAcademico", label: "Nivel académico" },
            { tipo: "texto", id: "centroEducativo", label: "Centro educativo" },
          ],
        },
      ],
    },
    {
      id: "convivencia",
      titulo: "Relación del menor con las personas que convive",
      grupos: [
        {
          id: "convivencia_g",
          campos: [
            {
              tipo: "opciones",
              id: "convive",
              label: "Convive con",
              multiple: true,
              opciones: [
                { valor: "MADRE", label: "Madre" },
                { valor: "PADRE", label: "Padre" },
                { valor: "HERMANOS", label: "Hermanos" },
              ],
            },
            { tipo: "texto", id: "conviveOtros", label: "Otros" },
            { tipo: "parrafo", id: "relacionDetalle", label: "Detalle de la relación" },
          ],
        },
      ],
    },
    {
      id: "historia_personal",
      titulo: "Historia personal",
      grupos: [
        {
          id: "historia_personal_g",
          campos: [
            { tipo: "texto", id: "diagnostico", label: "Evaluación (Dx)" },
            { tipo: "texto", id: "medicacion", label: "Medicación (dosis)" },
            { tipo: "texto", id: "terapiasRealiza", label: "Terapias que realiza" },
            { tipo: "texto", id: "dificultadesDormir", label: "Dificultades para dormir" },
            { tipo: "texto", id: "dificultadesComer", label: "Dificultades en la alimentación" },
            { tipo: "texto", id: "dificultadesPresenta", label: "Dificultades que presenta" },
          ],
        },
      ],
    },
    {
      id: "antecedentes_escolares",
      titulo: "Antecedentes escolares",
      grupos: [
        {
          id: "antecedentes_escolares_g",
          campos: [
            { tipo: "texto", id: "preescolar", label: "Preescolar" },
            { tipo: "texto", id: "escolar", label: "Escolar" },
            { tipo: "texto", id: "comportamientoAula", label: "Comportamiento en el aula" },
            { tipo: "texto", id: "rendimientoEscolar", label: "Rendimiento escolar" },
            {
              tipo: "texto",
              id: "dificultadesEscolares",
              label: "Dificultades que presenta",
              ancho: "completo",
            },
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
                { id: "cond_respuesta_estimulo", label: "Respuesta a un estímulo" },
                { id: "cond_respuesta_nombre", label: "Respuesta a su nombre" },
                { id: "cond_mirada_sostenida", label: "Mirada sostenida" },
              ],
            },
          ],
        },
        {
          id: "instrucciones",
          titulo: "Seguimiento de instrucciones básicas",
          campos: [
            {
              tipo: "checklist",
              id: "chk_instrucciones",
              items: [
                { id: "cond_saluda_despide", label: "Saluda - Despide" },
                { id: "cond_parate_sientate", label: "Párate - Siéntate" },
                { id: "cond_dame_toma", label: "Dame - Toma" },
                { id: "cond_guarda_recoge", label: "Guarda - Recoge" },
                { id: "cond_ven_vamos", label: "Ven - Vamos" },
                { id: "cond_lleva_dale", label: "Lleva - Dale" },
              ],
            },
          ],
        },
        {
          id: "intencion",
          titulo: "Intención comunicativa",
          campos: [
            {
              tipo: "checklist",
              id: "chk_intencion",
              items: [
                { id: "cond_senala", label: "Señala" },
                { id: "cond_solicita_pide", label: "Solicita - Pide" },
              ],
            },
          ],
        },
        {
          id: "inflexibilidad",
          titulo: "Inflexibilidad",
          campos: [
            {
              tipo: "checklist",
              id: "chk_inflexibilidad",
              items: [
                { id: "cond_cambio_actividad", label: "Cambio de actividad" },
                { id: "cond_retiro_estimulo", label: "Retiro de estímulo" },
                { id: "cond_cambio_rutina", label: "Cambio de rutina" },
                { id: "cond_intereses_restringidos", label: "Intereses restringidos" },
              ],
            },
          ],
        },
        {
          id: "permanencia",
          titulo: "Permanencia",
          campos: [
            {
              tipo: "checklist",
              id: "chk_permanencia",
              items: [
                { id: "cond_perm_mesa", label: "En mesa" },
                { id: "cond_perm_actividad", label: "En actividad" },
                { id: "cond_perm_con_estimulo", label: "Con estímulo" },
                { id: "cond_perm_sin_estimulo", label: "Sin estímulo" },
              ],
            },
          ],
        },
        {
          id: "espera",
          titulo: "Tiempo de espera",
          campos: [
            {
              tipo: "checklist",
              id: "chk_espera",
              items: [
                { id: "cond_espera_con_actividad", label: "Con actividad" },
                { id: "cond_espera_sin_actividad", label: "Sin actividad" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "lenguaje",
      titulo: "Área de lenguaje",
      escalaId: "SINO",
      grupos: [
        {
          id: "modalidad_g",
          campos: [
            {
              tipo: "opciones",
              id: "modalidadLenguaje",
              label: "Modalidad",
              multiple: false,
              opciones: [
                { valor: "VERBAL", label: "Verbal" },
                { valor: "NO_VERBAL", label: "No verbal" },
              ],
            },
          ],
        },
        {
          id: "leng_verbal",
          titulo: "Verbal",
          visibleSi: { campoId: "modalidadLenguaje", valores: ["VERBAL"] },
          campos: [
            {
              tipo: "checklist",
              id: "chk_verbal",
              items: [
                { id: "leng_onomatopeyicos", label: "Emite sonidos onomatopéyicos" },
                { id: "leng_ecolalia", label: "Ecolalia" },
                { id: "leng_contacto_visual", label: "Contacto visual" },
                { id: "leng_comprende_social", label: "Comprende lenguaje social (razonamiento)" },
              ],
            },
          ],
        },
        {
          id: "leng_no_verbal",
          titulo: "No verbal",
          visibleSi: { campoId: "modalidadLenguaje", valores: ["NO_VERBAL"] },
          campos: [
            {
              tipo: "checklist",
              id: "chk_no_verbal",
              items: [
                { id: "leng_imitacion", label: "Muestra imitación" },
                { id: "leng_comprende_indicaciones", label: "Comprende indicaciones" },
                { id: "leng_asocia_imagenes", label: "Reconoce y asocia imágenes" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "cognitiva",
      titulo: "Área cognitiva",
      escalaId: "SINO",
      grupos: [
        {
          id: "cog_general",
          campos: [
            {
              tipo: "checklist",
              id: "chk_cognitiva",
              items: [
                { id: "cog_numeros", label: "Reconoce números" },
                { id: "cog_vocales", label: "Reconoce vocales" },
                { id: "cog_colores", label: "Identifica colores" },
                { id: "cog_formas", label: "Identifica formas" },
                { id: "cog_figura_fondo", label: "Figura fondo" },
              ],
            },
          ],
        },
        {
          id: "cog_espaciales",
          titulo: "Nociones espaciales",
          campos: [
            {
              tipo: "checklist",
              id: "chk_espaciales",
              items: [
                { id: "cog_grande_pequeno", label: "Grande - Pequeño" },
                { id: "cog_largo_corto", label: "Largo - Corto" },
                { id: "cog_grueso_delgado", label: "Grueso - Delgado" },
                { id: "cog_pocos_muchos", label: "Pocos - Muchos" },
              ],
            },
          ],
        },
        {
          id: "cog_atencion",
          titulo: "Atención y concentración",
          campos: [
            {
              tipo: "checklist",
              id: "chk_atencion",
              items: [
                { id: "cog_atencion_sostenida", label: "Sostenido" },
                { id: "cog_atencion_espontaneo", label: "Espontáneo" },
                { id: "cog_atencion_disperso", label: "Disperso" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "sensorial",
      titulo: "Área sensorial",
      escalaId: "SINO",
      grupos: [
        {
          id: "sens_texturas",
          titulo: "Tolera texturas",
          campos: [
            {
              tipo: "checklist",
              id: "chk_texturas",
              items: [
                { id: "sens_seco", label: "Seco" },
                { id: "sens_humedo", label: "Húmedo" },
                { id: "sens_suave", label: "Suave" },
              ],
            },
          ],
        },
        {
          id: "sens_general",
          campos: [
            {
              tipo: "checklist",
              id: "chk_sensorial",
              items: [
                { id: "sens_sonidos_fuertes", label: "Tolera sonidos fuertes" },
                { id: "sens_integracion", label: "Presenta dificultad en la integración sensorial" },
              ],
            },
            {
              tipo: "parrafo",
              id: "observacionSensorial",
              label: "Observación (hipo – híper sensibilidad)",
            },
          ],
        },
      ],
    },
    {
      id: "psicomotricidad",
      titulo: "Psicomotricidad",
      escalaId: "SINO",
      grupos: [
        {
          id: "psic_gruesa",
          titulo: "Motricidad gruesa, actividades en circuito",
          campos: [
            {
              tipo: "checklist",
              id: "chk_gruesa",
              items: [
                { id: "psic_imita", label: "Imita y realiza las acciones mostradas" },
                { id: "psic_equilibrio", label: "Presenta equilibrio y coordinación" },
                { id: "psic_circuito", label: "Logra terminar el circuito" },
                { id: "psic_frustra", label: "Se frustra al realizar la actividad" },
              ],
            },
          ],
        },
        {
          id: "psic_fina_g",
          titulo: "Motricidad fina",
          campos: [
            {
              tipo: "checklist",
              id: "chk_fina",
              items: [{ id: "psic_fina", label: "Realiza las actividades brindadas" }],
            },
            {
              tipo: "parrafo",
              id: "observacionMotriz",
              label: "Observación (presenta problemas motrices)",
            },
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
          campos: [
            { tipo: "parrafo", id: "observacionGeneral", label: "Observación", filas: 5 },
          ],
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
      id: "lenguaje",
      titulo: "ÁREA DE LENGUAJE",
      escalaId: "EIEPLE",
      itemsAbiertos: true,
      grupos: [
        {
          id: "lenguaje_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_lenguaje",
              items: [
                { id: "len_comprensivo", label: "Lenguaje comprensivo" },
                { id: "len_articulado", label: "Lenguaje articulado" },
                { id: "len_narrativo", label: "Lenguaje narrativo" },
                { id: "len_tema", label: "Tema: “Sonidos onomatopéyicos”" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "pedagogica",
      titulo: "ÁREA PEDAGÓGICA",
      escalaId: "EIEPLE",
      itemsAbiertos: true,
      grupos: [
        {
          id: "pedagogica_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_pedagogica",
              items: [
                {
                  id: "ped_nociones_espaciales",
                  label: "Nociones espaciales (arriba-abajo, grande-pequeño, largo-corto)",
                },
                { id: "ped_colores", label: "Identifica los colores primarios y secundarios" },
                {
                  id: "ped_figuras",
                  label: "Identifica las figuras geométricas (círculo, cuadrado y triángulo)",
                },
                {
                  id: "ped_partes_cuerpo",
                  label:
                    "Reconoce y señala las partes del cuerpo (cara, brazos, piernas, abdomen, espalda, mano)",
                },
                {
                  id: "ped_motricidad_fina",
                  label:
                    "Realiza actividades de motricidad fina (rasgado, embolillado, moteo, dactilopintura)",
                },
                {
                  id: "ped_motricidad_gruesa",
                  label:
                    "Realiza actividades de motricidad gruesa mediante circuitos (traslado de objetos, equilibrio, arrastre)",
                },
                {
                  id: "ped_secuencia_imagenes",
                  label: "Describe a través de imágenes la secuencia que se le indica",
                },
                {
                  id: "ped_material_concreto",
                  label: "Realiza actividades con material concreto y muestra interés en realizarlo",
                },
                {
                  id: "ped_sensoriales",
                  label: "Tolera actividades sensoriales a nivel táctil y a nivel corporal",
                },
                { id: "ped_columpio", label: "Tolera realizar actividades en el columpio vestibular" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "autonomia",
      titulo: "AUTONOMÍA",
      escalaId: "EIEPLE",
      itemsAbiertos: true,
      grupos: [
        {
          id: "autonomia_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_autonomia",
              items: [
                { id: "aut_lavado_manos", label: "Realiza el lavado de mano siguiendo la secuencia indicada" },
                {
                  id: "aut_espera_material",
                  label: "Se sienta y espera para entregarle algún material deseado",
                },
                {
                  id: "aut_sigue_indicaciones",
                  label: "Es accesible a seguir las indicaciones luego de dar la orden dentro del aula",
                },
                { id: "aut_sentado_lonchera", label: "Logra mantenerse sentado al momento de comer la lonchera" },
                {
                  id: "aut_necesidades_fisiologicas",
                  label: "Muestra independencia cuando requiere sus necesidades fisiológicas",
                },
                {
                  id: "aut_tolerancia_cambios",
                  label: "Muestra tolerancia a cambios de actividades con previa anticipación",
                },
                {
                  id: "aut_deberes_aula",
                  label:
                    "Realiza deberes brindado dentro del aula (sacar y guardar la silla, sacar y guardar juguetes, guardar lonchera, botar los desperdicios a la basura)",
                },
                { id: "aut_juegos_reglas", label: "Realiza juegos respetando las reglas indicadas" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "social",
      titulo: "SOCIAL",
      escalaId: "EIEPLE",
      itemsAbiertos: true,
      grupos: [
        {
          id: "social_g",
          campos: [
            {
              tipo: "checklist",
              id: "chk_social",
              items: [
                { id: "soc_saluda_despide", label: "Saluda y se despide de sus compañeros de aula" },
                { id: "soc_interactua", label: "Interactúa con otros niños, respetándolos" },
                { id: "soc_actividades_grupo", label: "Realiza actividades en grupo" },
                {
                  id: "soc_respeta_turnos",
                  label: "Respeta turnos al momento de realizar actividades con sus compañeros",
                },
                { id: "soc_interes_jugar", label: "Muestra interés de jugar con sus compañeros" },
                {
                  id: "soc_contacto_visual",
                  label:
                    "Al momento de realizar alguna actividad mantiene contacto visual de manera espontánea",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const PSICOLOGICA: Record<TipoFicha, Plantilla> = {
  HISTORIA,
  EVALUACION,
  INFORME,
};
