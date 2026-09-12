import type { ReactNode } from "react";
import type { Metadata } from "next";
import {
  requireUser,
  getCurrentUser,
  getCentro,
  getSedesForUser,
  getActiveSedeId,
} from "@/lib/session";
import { iniciales } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { SedeSwitcher } from "@/components/sede-switcher";
import { cerrarSesion } from "./actions";

const ROL_LABEL: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  COORDINADOR: "Coordinador",
  USUARIO: "Usuario",
};

/** La pestaña muestra el nombre del centro con el que se inició sesión. */
export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user?.centroId) return {};
  const centro = await getCentro(user.centroId);
  return { title: `${centro.nombre} — Terapias` };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [centro, sedes, activeSedeId] = await Promise.all([
    getCentro(user.centroId),
    getSedesForUser(user),
    getActiveSedeId(user),
  ]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-sm font-bold text-white">
            {iniciales(centro.nombre)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900" title={centro.nombre}>
              {centro.nombre}
            </p>
            <p className="truncate text-xs text-slate-400">
              {centro.subtitulo ?? "Terapias"}
            </p>
          </div>
        </div>
        <Sidebar rol={user.rol} />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <SedeSwitcher sedes={sedes} activeSedeId={activeSedeId ?? ""} />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user.nombre}</p>
              <p className="text-xs text-slate-400">{ROL_LABEL[user.rol]}</p>
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

        <main className="flex-1 space-y-6 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
