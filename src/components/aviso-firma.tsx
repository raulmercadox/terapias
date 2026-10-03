"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Aviso al terapeuta sin firma registrada (no se muestra en la propia página de firma). */
export function AvisoFirma() {
  const pathname = usePathname();
  if (pathname.startsWith("/mi-firma")) return null;
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Aún no registras tu firma; la necesitarás para firmar informes y
      evaluaciones.{" "}
      <Link href="/mi-firma" className="font-medium underline">
        Registrar mi firma
      </Link>
    </p>
  );
}
