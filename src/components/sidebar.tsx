"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rol } from "@prisma/client";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: string };

// El rol USUARIO solo ve Inicio, Citas/Agenda y Sesiones.
const NAV_USUARIO: NavItem[] = [
  { href: "/panel", label: "Inicio", icon: "🏠" },
  { href: "/citas", label: "Citas / Agenda", icon: "📅" },
  { href: "/sesiones", label: "Sesiones", icon: "📋" },
];

// El TERAPEUTA ve lo suyo: su agenda, sus pacientes (parte clínica) y su firma.
const NAV_TERAPEUTA: NavItem[] = [
  { href: "/panel", label: "Inicio", icon: "🏠" },
  { href: "/citas", label: "Mi agenda", icon: "📅" },
  { href: "/pacientes", label: "Mis pacientes", icon: "🧒" },
  { href: "/mi-firma", label: "Mi firma", icon: "✍️" },
];

const NAV_CITA_RAPIDA: NavItem = {
  href: "/citas/rapida",
  label: "Registro rápido",
  icon: "⚡",
};

const NAV: NavItem[] = [
  { href: "/panel", label: "Inicio", icon: "🏠" },
  { href: "/pacientes", label: "Pacientes", icon: "🧒" },
  { href: "/seguimiento", label: "Seguimiento", icon: "📞" },
  { href: "/citas", label: "Citas / Agenda", icon: "📅" },
  { href: "/sesiones", label: "Sesiones", icon: "📋" },
  { href: "/pagos", label: "Pagos", icon: "💵" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/configuracion", label: "Configuración", icon: "⚙️" },
];

export function Sidebar({
  rol,
  citaRapida = false,
}: {
  rol: Rol;
  /** Terapeuta con permiso de registrar citas al vuelo. */
  citaRapida?: boolean;
}) {
  const pathname = usePathname();
  const items =
    rol === "TERAPEUTA"
      ? citaRapida
        ? [NAV_TERAPEUTA[0], NAV_CITA_RAPIDA, ...NAV_TERAPEUTA.slice(1)]
        : NAV_TERAPEUTA
      : rol === "USUARIO"
        ? NAV_USUARIO
        : rol === "ADMINISTRADOR"
          ? [...NAV, ...ADMIN_NAV]
          : NAV;

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        // Ya no hace falta el caso especial de "/": existía solo porque
        // startsWith("/") es cierto para cualquier ruta. El inicio es /panel.
        // El ítem más específico gana: en /citas/rapida no se marca /citas.
        const active =
          pathname.startsWith(item.href) &&
          !items.some(
            (otro) =>
              otro.href.length > item.href.length &&
              otro.href.startsWith(item.href) &&
              pathname.startsWith(otro.href),
          );
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sky-600 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
