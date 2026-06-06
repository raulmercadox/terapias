"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: string };

const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/pacientes", label: "Pacientes", icon: "🧒" },
  { href: "/citas", label: "Citas / Agenda", icon: "📅" },
  { href: "/sesiones", label: "Sesiones", icon: "📋" },
  { href: "/pagos", label: "Pagos", icon: "💵" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/configuracion", label: "Configuración", icon: "⚙️" },
];

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
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
