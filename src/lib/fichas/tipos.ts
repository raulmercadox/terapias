// Forma de las plantillas de fichas clínicas y de los valores que se registran
// con ellas. Módulo puro (sin "use server" ni "server-only"): lo importan el
// formulario cliente, las server actions, las vistas y las pruebas — igual que
// hacían los catálogos fijos que reemplaza (evaluaciones/ficha.ts,
// informes/informe.ts, historia/historia.ts).
//
// La estructura de la Historia Clínica, la Ficha de Evaluación y el Informe de
// Avance dejó de estar escrita en el código: ahora cada centro tiene su propia
// plantilla, para que el sistema sirva tanto a terapia psicológica como física.

export const TIPOS_FICHA = ["HISTORIA", "EVALUACION", "INFORME"] as const;
export type TipoFicha = (typeof TIPOS_FICHA)[number];

export const TIPO_FICHA_LABEL: Record<TipoFicha, string> = {
  HISTORIA: "Historia clínica",
  EVALUACION: "Ficha de evaluación",
  INFORME: "Informe de avance",
};

/* ── Escalas ──────────────────────────────────────────── */

/**
 * Escala ordinal con la que se califica un ítem. Generaliza las tres que
 * estaban clavadas en el código: I/P/L (área conductual), SI/NO (áreas de la
 * ficha) y EI/EP/LE (informe de avance).
 *
 * El orden de `valores` es significativo: define el orden de las columnas al
 * imprimir y el puntaje 0..n-1 que usa la analítica de progreso.
 */
export type Escala = {
  id: string;
  valores: string[];
  /** Texto largo de cada valor, para la leyenda: { EI: "En Inicio", … }. */
  labels: Record<string, string>;
};

/* ── Campos ───────────────────────────────────────────── */

/** Ancho del campo en la rejilla del formulario. */
export type AnchoCampo = "medio" | "completo";

export type Campo =
  /** Una línea: "Lugar de nacimiento", "Dosis". */
  | { tipo: "texto"; id: string; label: string; ayuda?: string; ancho?: AnchoCampo }
  /** Varias líneas: "¿Cómo se presentó esta dificultad?". */
  | { tipo: "parrafo"; id: string; label: string; ayuda?: string; filas?: number }
  /** Casilla suelta. */
  | { tipo: "casilla"; id: string; label: string }
  /** Radios (multiple: false) o grupo de casillas (multiple: true). */
  | {
      tipo: "opciones";
      id: string;
      label: string;
      multiple: boolean;
      opciones: { valor: string; label: string }[];
      ayuda?: string;
    }
  /** Tabla de filas variables con columnas fijas (la historia familiar). */
  | {
      tipo: "tabla";
      id: string;
      label: string;
      columnas: { id: string; label: string; ancho?: "corto" | "normal" }[];
      /** Filas precargadas al abrir el formulario, ej. [{parentesco:"Padre"}]. */
      filasSugeridas?: Record<string, string>[];
    }
  /** Lista de ítems calificados con una escala (las áreas y los informes). */
  | {
      tipo: "checklist";
      id: string;
      label?: string | null;
      /** Si falta, hereda la escala de la sección. */
      escalaId?: string;
      /** Si falta, hereda `conObservacion` de la sección. */
      conObservacion?: boolean;
      items: { id: string; label: string }[];
    };

export type TipoCampo = Campo["tipo"];

/* ── Grupos y secciones ───────────────────────────────── */

export type Grupo = {
  id: string;
  /** Subtítulo dentro de la sección ("Fijación de mirada"). */
  titulo?: string | null;
  /**
   * Visibilidad condicional. Única regla soportada: el grupo se ve si el campo
   * `campoId` tiene alguno de `valores`. Si ese campo aún no tiene valor, el
   * grupo se muestra — misma política que el `grupoAplica` que reemplaza, donde
   * una modalidad sin elegir dejaba ver todos los grupos para poder llenar
   * cualquiera. Sin AND/OR ni anidamiento: el único caso real del sistema (la
   * modalidad de lenguaje) cabe entero aquí.
   */
  visibleSi?: { campoId: string; valores: string[] };
  campos: Campo[];
};

export type Seccion = {
  id: string;
  /** Sin numeración: "I.", "II.1" se calculan al pintar (ver numeracion.ts). */
  titulo: string;
  descripcion?: string | null;
  /** Escala por defecto de los checklists de la sección. */
  escalaId?: string | null;
  /** Columna de observación por defecto de los checklists de la sección. */
  conObservacion?: boolean;
  /** Numera los grupos dentro de la sección ("II.1", "II.2"). */
  numerarGrupos?: boolean;
  /**
   * Solo INFORME: el profesional agrega y edita ítems en cada ficha. Es lo que
   * obliga a que el informe guarde su estructura completa por registro.
   */
  itemsAbiertos?: boolean;
  grupos: Grupo[];
};

export type Plantilla = {
  /** Versión del ESQUEMA de este JSON (no de la plantilla del centro). */
  formato: 1;
  escalas: Escala[];
  secciones: Seccion[];
  numerarSecciones?: boolean;
  /**
   * Solo EVALUACION: muestra la sección final "programa recomendado", que no es
   * un campo de la plantilla sino una columna del modelo (alimenta
   * Paciente.programa). Un centro de terapia física puede ocultarla.
   */
  muestraProgramaRecomendado?: boolean;
};

/* ── Valores registrados ──────────────────────────────── */

/**
 * Valor de un campo. Lleva su tipo (`t`) a propósito: cuando un campo se quita
 * de la plantilla, su valor NO se borra de la ficha, y hay que poder mostrarlo
 * sin adivinar cómo se guardó. Es la misma idea con la que el informe conserva
 * al final las secciones que ya no están en el catálogo.
 */
export type ValorCampo =
  | { t: "texto"; v: string }
  | { t: "casilla"; v: boolean }
  | { t: "opciones"; v: string[] }
  | { t: "tabla"; filas: Record<string, string>[] }
  | { t: "checklist"; items: Record<string, { valor?: string; obs?: string }> };

/** Lo registrado en una ficha: { [campoId]: ValorCampo }. */
export type ValoresFicha = Record<string, ValorCampo>;

/**
 * Los ids de campo son únicos en TODA la plantilla, no solo dentro de su
 * sección, porque los valores se guardan en un mapa plano por id. Lo verifica
 * `idsDuplicados` (plantilla.ts) y lo exige el editor antes de guardar.
 */
export type ResultadoValidacion = { ok: true } | { ok: false; error: string };
