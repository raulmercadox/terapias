import { permanentRedirect } from "next/navigation";

/** Ruta antigua: los programas ahora son "Terapias". */
export default function ProgramasPage() {
  permanentRedirect("/configuracion/terapias");
}
