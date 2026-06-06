import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";

export default async function ConfiguracionPage() {
  const user = await requireUser();
  if (user.rol !== "ADMINISTRADOR") notFound();

  const secciones = [
    {
      label: "Usuarios",
      descripcion: "Cuentas de acceso, roles y asignación de sedes.",
      href: "/configuracion/usuarios",
      icon: "👤",
    },
    {
      label: "Sedes",
      descripcion: "Locales del centro: nombre, dirección y contacto.",
      href: "/configuracion/sedes",
      icon: "🏢",
    },
    {
      label: "Terapeutas",
      descripcion: "Profesionales que atienden en cada sede.",
      href: "/configuracion/terapeutas",
      icon: "🧑‍⚕️",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        subtitle="Administración del sistema (solo administradores)."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <span className="text-3xl" aria-hidden>
                {s.icon}
              </span>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                {s.label}
              </p>
              <p className="mt-1 text-sm text-slate-500">{s.descripcion}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
