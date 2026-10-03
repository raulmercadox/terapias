/**
 * Bloque de firma para el pie de un documento imprimible (dentro de
 * `.print-area`): la firma dibujada por el terapeuta, una línea, su nombre y
 * sus especialidades. Pensado para cuando se firmen los informes de avance y
 * las evaluaciones; la firma sale de `Terapeuta.firma`.
 */
export function FirmaProfesional({
  nombre,
  especialidades = [],
  firma,
}: {
  nombre: string;
  especialidades?: string[];
  /** PNG como data URL; null si el terapeuta aún no la registra. */
  firma: string | null;
}) {
  return (
    <div className="mt-12 flex justify-end break-inside-avoid">
      <div className="w-64 text-center text-sm">
        <div className="flex h-20 items-end justify-center">
          {firma && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL
            <img
              src={firma}
              alt={`Firma de ${nombre}`}
              className="max-h-20 max-w-full object-contain"
            />
          )}
        </div>
        <div className="border-t border-slate-900 pt-1">
          <p className="font-semibold">{nombre}</p>
          {especialidades.length > 0 && (
            <p className="text-xs">{especialidades.join(" · ")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
