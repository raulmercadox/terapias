// Catálogo de la Ficha de Evaluación inicial: áreas V–IX del formato impreso
// del centro. SIN "use server": se importa desde el formulario (cliente), las
// server actions y las vistas. Los resultados se guardan en Evaluacion.resultados
// como { [itemId]: { valor?, obs? } } — este catálogo define los ids válidos y
// el dominio de valores de cada área.

export const VALORES_IPL = ["I", "P", "L"] as const;
export const VALORES_SINO = ["SI", "NO"] as const;

/** Etiquetas de los indicadores I/P/L del área conductual. */
export const IPL_LABEL: Record<string, string> = {
  I: "Inicio",
  P: "Proceso",
  L: "Logrado",
};

export type ItemFicha = { id: string; label: string };
export type GrupoFicha = { titulo: string | null; items: ItemFicha[] };
export type AreaFicha = {
  id: string;
  titulo: string;
  tipo: "IPL" | "SINO";
  /** Si cada ítem lleva una columna de observación libre. */
  conObservacion: boolean;
  grupos: GrupoFicha[];
};

export const AREAS_FICHA: AreaFicha[] = [
  {
    id: "conductual",
    titulo: "V. Área conductual",
    tipo: "IPL",
    conObservacion: true,
    grupos: [
      {
        titulo: "Fijación de mirada",
        items: [
          { id: "cond_contacto_visual", label: "Contacto visual" },
          { id: "cond_respuesta_estimulo", label: "Respuesta a un estímulo" },
          { id: "cond_respuesta_nombre", label: "Respuesta a su nombre" },
          { id: "cond_mirada_sostenida", label: "Mirada sostenida" },
        ],
      },
      {
        titulo: "Seguimiento de instrucciones básicas",
        items: [
          { id: "cond_saluda_despide", label: "Saluda - Despide" },
          { id: "cond_parate_sientate", label: "Párate - Siéntate" },
          { id: "cond_dame_toma", label: "Dame - Toma" },
          { id: "cond_guarda_recoge", label: "Guarda - Recoge" },
          { id: "cond_ven_vamos", label: "Ven - Vamos" },
          { id: "cond_lleva_dale", label: "Lleva - Dale" },
        ],
      },
      {
        titulo: "Intención comunicativa",
        items: [
          { id: "cond_senala", label: "Señala" },
          { id: "cond_solicita_pide", label: "Solicita - Pide" },
        ],
      },
      {
        titulo: "Inflexibilidad",
        items: [
          { id: "cond_cambio_actividad", label: "Cambio de actividad" },
          { id: "cond_retiro_estimulo", label: "Retiro de estímulo" },
          { id: "cond_cambio_rutina", label: "Cambio de rutina" },
          { id: "cond_intereses_restringidos", label: "Intereses restringidos" },
        ],
      },
      {
        titulo: "Permanencia",
        items: [
          { id: "cond_perm_mesa", label: "En mesa" },
          { id: "cond_perm_actividad", label: "En actividad" },
          { id: "cond_perm_con_estimulo", label: "Con estímulo" },
          { id: "cond_perm_sin_estimulo", label: "Sin estímulo" },
        ],
      },
      {
        titulo: "Tiempo de espera",
        items: [
          { id: "cond_espera_con_actividad", label: "Con actividad" },
          { id: "cond_espera_sin_actividad", label: "Sin actividad" },
        ],
      },
    ],
  },
  {
    id: "lenguaje",
    titulo: "VI. Área de lenguaje",
    tipo: "SINO",
    conObservacion: false,
    grupos: [
      {
        titulo: "Verbal",
        items: [
          { id: "leng_onomatopeyicos", label: "Emite sonidos onomatopéyicos" },
          { id: "leng_ecolalia", label: "Ecolalia" },
          { id: "leng_contacto_visual", label: "Contacto visual" },
          {
            id: "leng_comprende_social",
            label: "Comprende lenguaje social (razonamiento)",
          },
        ],
      },
      {
        titulo: "No verbal",
        items: [
          { id: "leng_imitacion", label: "Muestra imitación" },
          { id: "leng_comprende_indicaciones", label: "Comprende indicaciones" },
          { id: "leng_asocia_imagenes", label: "Reconoce y asocia imágenes" },
        ],
      },
    ],
  },
  {
    id: "cognitiva",
    titulo: "VII. Área cognitiva",
    tipo: "SINO",
    conObservacion: false,
    grupos: [
      {
        titulo: null,
        items: [
          { id: "cog_numeros", label: "Reconoce números" },
          { id: "cog_vocales", label: "Reconoce vocales" },
          { id: "cog_colores", label: "Identifica colores" },
          { id: "cog_formas", label: "Identifica formas" },
          { id: "cog_figura_fondo", label: "Figura fondo" },
        ],
      },
      {
        titulo: "Nociones espaciales",
        items: [
          { id: "cog_grande_pequeno", label: "Grande - Pequeño" },
          { id: "cog_largo_corto", label: "Largo - Corto" },
          { id: "cog_grueso_delgado", label: "Grueso - Delgado" },
          { id: "cog_pocos_muchos", label: "Pocos - Muchos" },
        ],
      },
      {
        titulo: "Atención y concentración",
        items: [
          { id: "cog_atencion_sostenida", label: "Sostenido" },
          { id: "cog_atencion_espontaneo", label: "Espontáneo" },
          { id: "cog_atencion_disperso", label: "Disperso" },
        ],
      },
    ],
  },
  {
    id: "sensorial",
    titulo: "VIII. Área sensorial",
    tipo: "SINO",
    conObservacion: false,
    grupos: [
      {
        titulo: "Tolera texturas",
        items: [
          { id: "sens_seco", label: "Seco" },
          { id: "sens_humedo", label: "Húmedo" },
          { id: "sens_suave", label: "Suave" },
        ],
      },
      {
        titulo: null,
        items: [
          { id: "sens_sonidos_fuertes", label: "Tolera sonidos fuertes" },
          {
            id: "sens_integracion",
            label: "Presenta dificultad en la integración sensorial",
          },
        ],
      },
    ],
  },
  {
    id: "psicomotricidad",
    titulo: "IX. Psicomotricidad",
    tipo: "SINO",
    conObservacion: false,
    grupos: [
      {
        titulo: "Motricidad gruesa, actividades en circuito",
        items: [
          { id: "psic_imita", label: "Imita y realiza las acciones mostradas" },
          { id: "psic_equilibrio", label: "Presenta equilibrio y coordinación" },
          { id: "psic_circuito", label: "Logra terminar el circuito" },
          { id: "psic_frustra", label: "Se frustra al realizar la actividad" },
        ],
      },
      {
        titulo: "Motricidad fina",
        items: [{ id: "psic_fina", label: "Realiza las actividades brindadas" }],
      },
    ],
  },
];

/** Dominio de valores válidos por ítem: { itemId: ["I","P","L"] | ["SI","NO"] }. */
const DOMINIO: Record<string, readonly string[]> = Object.fromEntries(
  AREAS_FICHA.flatMap((area) =>
    area.grupos.flatMap((g) =>
      g.items.map((it) => [
        it.id,
        area.tipo === "IPL" ? VALORES_IPL : VALORES_SINO,
      ]),
    ),
  ),
);

export type ResultadoItem = { valor?: string; obs?: string };
export type Resultados = Record<string, ResultadoItem>;

/**
 * Limpia un objeto de resultados contra el catálogo: descarta ids que no
 * existen, valores fuera del dominio del área (I/P/L o SI/NO) y entradas
 * vacías. Acepta `unknown` porque el origen es JSON (formulario o BD).
 */
export function normalizarResultados(input: unknown): Resultados {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const out: Resultados = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    const dominio = DOMINIO[id];
    if (!dominio || raw == null || typeof raw !== "object") continue;
    const { valor, obs } = raw as { valor?: unknown; obs?: unknown };
    const item: ResultadoItem = {};
    if (typeof valor === "string" && dominio.includes(valor)) item.valor = valor;
    if (typeof obs === "string" && obs.trim() !== "") item.obs = obs.trim();
    if (item.valor !== undefined || item.obs !== undefined) out[id] = item;
  }
  return out;
}
