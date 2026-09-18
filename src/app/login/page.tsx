import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { LoginForm } from "./login-form";
import { EMPRESA_COOKIE } from "./constantes";
// Misma foto que usa la portada (Unsplash, licencia libre).
import fotoSesion from "../_fotos/sesion.webp";

// Lo que se destaca en el panel de la izquierda: lo mismo que promete la portada.
const DESTACADOS = [
  "Fichas clínicas que cada centro configura a su medida",
  "Agenda por terapeuta, con control de asistencia",
  "Paquetes de sesiones, pagos y todas tus sedes en una cuenta",
];

function IconCheck({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

function IconArrowLeft({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export default async function LoginPage() {
  const empresa = (await cookies()).get(EMPRESA_COOKIE)?.value;

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* ── Panel de marca (solo en pantallas grandes) ───────────────────────── */}
      <aside className="relative hidden bg-sky-900 lg:flex lg:flex-col lg:justify-between lg:overflow-hidden lg:p-12">
        {/* Duotono: la foto en luminosidad sobre el azul de la marca. Se ve la
            escena, pero el panel sigue siendo de un solo color. */}
        <Image
          src={fotoSesion}
          alt=""
          aria-hidden
          fill
          sizes="50vw"
          className="object-cover opacity-70 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sky-950/85 via-sky-900/60 to-sky-900/45" />

        <Link href="/" className="relative flex items-center gap-2 text-white">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white font-bold text-sky-700">
            T
          </span>
          <span className="text-lg font-bold tracking-tight">Terapias</span>
        </Link>

        <div className="relative max-w-md text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-sky-50 backdrop-blur-sm">
            <IconCheck className="h-3.5 w-3.5" /> Para terapia física y psicológica
          </span>
          <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight">
            La gestión de tu centro, sin perder el hilo de ningún paciente
          </h2>
          <ul className="mt-8 space-y-4">
            {DESTACADOS.map((d) => (
              <li key={d} className="flex items-start gap-3 text-sky-50">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <IconCheck className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm leading-relaxed">{d}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sky-100/80">
          © {new Date().getFullYear()} Codart · Sistema de gestión para centros de terapia
        </p>
      </aside>

      {/* ── Formulario ──────────────────────────────────────────────────────── */}
      <main className="relative flex min-h-screen flex-col justify-center overflow-hidden px-6 py-12 lg:min-h-0 lg:px-12">
        {/* Degradado suave de fondo: en móvil sustituye al panel de la foto. */}
        <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-sky-50 to-white lg:hidden" />

        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
          >
            <IconArrowLeft /> Volver al inicio
          </Link>

          <div className="mt-6 flex items-center gap-2 lg:hidden">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 font-bold text-white">
              T
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">Terapias</span>
          </div>

          <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-900">
            Ingresa a tu centro
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Usa el nombre corto de tu centro y los datos de tu usuario.
          </p>

          <div className="mt-8">
            <LoginForm empresa={empresa} />
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            ¿Tu centro todavía no usa Terapias?{" "}
            <Link href="/#contacto" className="font-medium text-sky-700 hover:text-sky-600">
              Solicita una demo
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
