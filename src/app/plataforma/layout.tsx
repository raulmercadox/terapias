import type { ReactNode } from "react";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/session";
import { cerrarSesion } from "@/app/(app)/actions";
import { CodartLogo } from "@/components/brand/codart-logo";

export const metadata = { title: "Plataforma — Codart Terapias" };

export default async function PlataformaLayout({ children }: { children: ReactNode }) {
  const user = await requireSuperadmin();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/plataforma/centros" className="flex items-center gap-3">
          <CodartLogo className="h-7 w-auto" />
          <span className="border-l border-slate-200 pl-3">
            <span className="block text-sm font-semibold text-slate-900">Terapias</span>
            <span className="block text-xs text-slate-400">Plataforma</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user.nombre}</p>
            <p className="text-xs text-slate-400">Superadmin</p>
          </div>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 md:p-6">{children}</main>
    </div>
  );
}
