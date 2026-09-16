// Paquetes por vencer: reglas puras para avisar a tiempo de renovar.
// Las fechas van como "YYYY-MM-DD" (hoy = hoyLima(), fin = claveFecha()).

/** Días de anticipación con que un paquete activo cuenta como "por vencer". */
export const DIAS_AVISO = 7;

export type EstadoVencimiento = "terminado" | "por-vencer";

export const VENCIMIENTO_COLOR: Record<EstadoVencimiento, "red" | "amber"> = {
  terminado: "red",
  "por-vencer": "amber",
};

/** "YYYY-MM-DD" → días desde la época (UTC), para restar sin zona horaria. */
function diaUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Días de `desde` a `hasta` ("YYYY-MM-DD"); negativo si `hasta` es anterior. */
export function diasEntreISO(desde: string, hasta: string): number {
  return diaUTC(hasta) - diaUTC(desde);
}

/** Suma `n` días a "YYYY-MM-DD". */
export function sumarDiasISO(iso: string, n: number): string {
  return new Date((diaUTC(iso) + n) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * ¿El paquete activo ya terminó o está por terminar? `finReal` es la fecha de
 * su última sesión no cancelada. Terminó si esa fecha ya pasó o si ya no le
 * quedan sesiones; está por vencer si termina dentro de `DIAS_AVISO` días.
 */
export function estadoVencimiento({
  finReal,
  restantes,
  hoy,
}: {
  finReal: string | null;
  restantes: number;
  hoy: string;
}): EstadoVencimiento | null {
  if (restantes <= 0) return "terminado";
  if (!finReal) return null;
  if (finReal < hoy) return "terminado";
  if (finReal <= sumarDiasISO(hoy, DIAS_AVISO)) return "por-vencer";
  return null;
}

/** Texto corto del aviso: "Terminó 10/09", "Termina mañana", "Termina 16/09 · en 3 días". */
export function textoVencimiento(
  estado: EstadoVencimiento,
  finReal: string | null,
  hoy: string,
): string {
  const dm = finReal ? `${finReal.slice(8, 10)}/${finReal.slice(5, 7)}` : "";
  if (estado === "terminado") return dm ? `Terminó ${dm}` : "Terminó";
  const dias = finReal ? diasEntreISO(hoy, finReal) : 0;
  if (dias === 0) return "Termina hoy";
  if (dias === 1) return "Termina mañana";
  return `Termina ${dm} · en ${dias} días`;
}

/**
 * Paquetes que ya fueron renovados: renovar crea otro paquete y deja el
 * anterior ACTIVO, así que uno cuenta como renovado si el mismo paciente tiene
 * otro paquete (de la lista recibida) creado después.
 */
export function paquetesRenovados(
  paquetes: { id: string; pacienteId: string; createdAt: Date }[],
): Set<string> {
  const masNuevo = new Map<string, Date>();
  for (const p of paquetes) {
    const actual = masNuevo.get(p.pacienteId);
    if (!actual || p.createdAt > actual) masNuevo.set(p.pacienteId, p.createdAt);
  }
  return new Set(
    paquetes
      .filter((p) => p.createdAt < masNuevo.get(p.pacienteId)!)
      .map((p) => p.id),
  );
}
