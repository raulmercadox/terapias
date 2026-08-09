// Catálogo del Informe de Avance. SIN "use server": se importa desde el
// formulario (cliente), las server actions y las vistas.
//
// A diferencia de la Ficha de Evaluación (evaluaciones/ficha.ts), donde el
// catálogo es fijo y solo se guardan los valores, aquí las secciones completas
// —incluido el texto de cada ítem— se copian dentro de InformeAvance.secciones
// al crear el informe. Editar un texto afecta solo a ese informe; los ya
// registrados conservan el suyo. SECCIONES_DEFECTO es únicamente el punto de
// partida al crear uno nuevo.

export const VALORES_INFORME = ["EI", "EP", "LE"] as const;
export type ValorInforme = (typeof VALORES_INFORME)[number];

/** Leyenda del formato impreso: "EI= En Inicio, EP= En Proceso, LE= Logro Esperado". */
export const VALOR_LABEL: Record<ValorInforme, string> = {
  EI: "En Inicio",
  EP: "En Proceso",
  LE: "Logro Esperado",
};

export type ItemInforme = {
  id: string;
  label: string;
  valor?: ValorInforme | null;
};

export type SeccionInforme = {
  id: string;
  titulo: string;
  items: ItemInforme[];
};

/**
 * Las cuatro secciones son fijas: el formulario permite editar, agregar y
 * quitar ítems, pero no crear ni renombrar secciones. Estos ids se usan para
 * reordenar y para reconciliar informes antiguos (ver `normalizarSecciones`).
 */
export const SECCIONES_DEFECTO: SeccionInforme[] = [
  {
    id: "lenguaje",
    titulo: "ÁREA DE LENGUAJE",
    items: [
      { id: "len_comprensivo", label: "Lenguaje comprensivo" },
      { id: "len_articulado", label: "Lenguaje articulado" },
      { id: "len_narrativo", label: "Lenguaje narrativo" },
      { id: "len_tema", label: "Tema: “Sonidos onomatopéyicos”" },
    ],
  },
  {
    id: "pedagogica",
    titulo: "ÁREA PEDAGÓGICA",
    items: [
      {
        id: "ped_nociones_espaciales",
        label:
          "Nociones espaciales (arriba-abajo, grande-pequeño, largo-corto)",
      },
      {
        id: "ped_colores",
        label: "Identifica los colores primarios y secundarios",
      },
      {
        id: "ped_figuras",
        label:
          "Identifica las figuras geométricas (círculo, cuadrado y triángulo)",
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
        label:
          "Realiza actividades con material concreto y muestra interés en realizarlo",
      },
      {
        id: "ped_sensoriales",
        label:
          "Tolera actividades sensoriales a nivel táctil y a nivel corporal",
      },
      {
        id: "ped_columpio",
        label: "Tolera realizar actividades en el columpio vestibular",
      },
    ],
  },
  {
    id: "autonomia",
    titulo: "AUTONOMÍA",
    items: [
      {
        id: "aut_lavado_manos",
        label: "Realiza el lavado de mano siguiendo la secuencia indicada",
      },
      {
        id: "aut_espera_material",
        label: "Se sienta y espera para entregarle algún material deseado",
      },
      {
        id: "aut_sigue_indicaciones",
        label:
          "Es accesible a seguir las indicaciones luego de dar la orden dentro del aula",
      },
      {
        id: "aut_sentado_lonchera",
        label: "Logra mantenerse sentado al momento de comer la lonchera",
      },
      {
        id: "aut_necesidades_fisiologicas",
        label:
          "Muestra independencia cuando requiere sus necesidades fisiológicas",
      },
      {
        id: "aut_tolerancia_cambios",
        label:
          "Muestra tolerancia a cambios de actividades con previa anticipación",
      },
      {
        id: "aut_deberes_aula",
        label:
          "Realiza deberes brindado dentro del aula (sacar y guardar la silla, sacar y guardar juguetes, guardar lonchera, botar los desperdicios a la basura)",
      },
      {
        id: "aut_juegos_reglas",
        label: "Realiza juegos respetando las reglas indicadas",
      },
    ],
  },
  {
    id: "social",
    titulo: "SOCIAL",
    items: [
      {
        id: "soc_saluda_despide",
        label: "Saluda y se despide de sus compañeros de aula",
      },
      {
        id: "soc_interactua",
        label: "Interactúa con otros niños, respetándolos",
      },
      { id: "soc_actividades_grupo", label: "Realiza actividades en grupo" },
      {
        id: "soc_respeta_turnos",
        label:
          "Respeta turnos al momento de realizar actividades con sus compañeros",
      },
      {
        id: "soc_interes_jugar",
        label: "Muestra interés de jugar con sus compañeros",
      },
      {
        id: "soc_contacto_visual",
        label:
          "Al momento de realizar alguna actividad mantiene contacto visual de manera espontánea",
      },
    ],
  },
];

/** Copia profunda de la plantilla, para precargar un informe nuevo. */
export function seccionesIniciales(): SeccionInforme[] {
  return SECCIONES_DEFECTO.map((s) => ({
    ...s,
    items: s.items.map((i) => ({ ...i })),
  }));
}

function esValor(v: unknown): v is ValorInforme {
  return (
    typeof v === "string" && (VALORES_INFORME as readonly string[]).includes(v)
  );
}

/**
 * Normaliza el Json que viene de la base. Descarta lo que no cumpla la forma
 * esperada en vez de confiar en el tipo: el campo es Json y pudo escribirse
 * desde una versión anterior del catálogo o a mano.
 *
 * Las secciones se devuelven siempre en el orden de SECCIONES_DEFECTO, y las
 * que falten (informe viejo, sección agregada después) se completan con la
 * plantilla para que el formato impreso no cambie entre informes.
 */
export function normalizarSecciones(valor: unknown): SeccionInforme[] {
  const guardadas = new Map<string, SeccionInforme>();

  if (Array.isArray(valor)) {
    for (const s of valor) {
      if (!s || typeof s !== "object") continue;
      const sec = s as Record<string, unknown>;
      if (typeof sec.id !== "string" || !sec.id) continue;

      const items: ItemInforme[] = Array.isArray(sec.items)
        ? sec.items.flatMap((i): ItemInforme[] => {
            if (!i || typeof i !== "object") return [];
            const it = i as Record<string, unknown>;
            if (typeof it.id !== "string" || !it.id) return [];
            if (typeof it.label !== "string") return [];
            const label = it.label.trim();
            if (!label) return [];
            return [
              { id: it.id, label, valor: esValor(it.valor) ? it.valor : null },
            ];
          })
        : [];

      guardadas.set(sec.id, {
        id: sec.id,
        titulo:
          typeof sec.titulo === "string" && sec.titulo.trim()
            ? sec.titulo.trim()
            : sec.id,
        items,
      });
    }
  }

  const resultado = SECCIONES_DEFECTO.map((base) => {
    const g = guardadas.get(base.id);
    if (!g) return { ...base, items: base.items.map((i) => ({ ...i })) };
    // El título lo manda la plantilla: las secciones no son editables.
    return { id: base.id, titulo: base.titulo, items: g.items };
  });

  // Secciones guardadas que ya no existen en la plantilla: se conservan al
  // final para no perder datos de informes antiguos.
  for (const [id, g] of guardadas) {
    if (!SECCIONES_DEFECTO.some((b) => b.id === id)) resultado.push(g);
  }

  return resultado;
}

/** Cuenta de ítems calificados sobre el total, para el resumen del listado. */
export function resumenAvance(secciones: SeccionInforme[]): {
  calificados: number;
  total: number;
} {
  let calificados = 0;
  let total = 0;
  for (const s of secciones) {
    for (const i of s.items) {
      total++;
      if (i.valor) calificados++;
    }
  }
  return { calificados, total };
}
