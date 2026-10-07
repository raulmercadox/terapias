import { claveFecha } from "./horario";

/** Un día de la plantilla semanal: getDay() (0=Dom..6=Sáb) y hora de inicio. */
export type DiaPlantilla = { dia: number; hora: string };

/**
 * Plantilla semanal de una terapia a partir de sus sesiones: el primer
 * horario visto por cada día de la semana.
 */
export function plantillaSemanal(
  sesiones: { fecha: Date; horaInicio: string }[],
): DiaPlantilla[] {
  const porDia = new Map<number, string>();
  for (const s of sesiones) {
    const dia = s.fecha.getDay();
    if (!porDia.has(dia)) porDia.set(dia, s.horaInicio);
  }
  return [...porDia.entries()].map(([dia, hora]) => ({ dia, hora }));
}

/**
 * Proyecta la plantilla semanal desde `desde` (inclusive), semana a semana,
 * y devuelve las sesiones que se pueden marcar: clave "YYYY-MM-DD" → hora.
 * Las franjas que no son `seleccionable` (terapeuta ocupado, feriado,
 * vacaciones…) se saltan sin reemplazo; se detiene al llegar a `total` o tras
 * `semanas` semanas, así que puede devolver menos de `total`.
 */
export function proyectarHorario(opts: {
  plantilla: DiaPlantilla[];
  total: number;
  desde: Date;
  semanas: number;
  seleccionable: (clave: string, hora: string) => boolean;
}): Record<string, string> {
  const out: Record<string, string> = {};
  if (opts.plantilla.length === 0 || opts.total <= 0) return out;

  const inicio = new Date(opts.desde);
  inicio.setHours(0, 0, 0, 0);
  const desdeClave = claveFecha(inicio);
  // Lunes de la semana de inicio; la plantilla se recorre lunes → domingo.
  const lunes = new Date(inicio);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const plantilla = [...opts.plantilla].sort(
    (a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7),
  );

  let n = 0;
  for (let semana = 0; semana <= opts.semanas && n < opts.total; semana++) {
    for (const { dia, hora } of plantilla) {
      if (n >= opts.total) break;
      const fecha = new Date(lunes);
      fecha.setDate(lunes.getDate() + semana * 7 + ((dia + 6) % 7));
      const clave = claveFecha(fecha);
      if (clave < desdeClave || clave in out) continue;
      if (!opts.seleccionable(clave, hora)) continue;
      out[clave] = hora;
      n++;
    }
  }
  return out;
}
