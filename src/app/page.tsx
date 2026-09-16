import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

// Portada pública de terapias.codart.pe. Vive fuera del grupo (app), así que no
// pasa por requireUser() y la ve cualquier visitante. El panel está en /panel.
//
// El texto describe solo lo que el sistema hace hoy. En particular NO se anuncia
// envío automático por WhatsApp: los recordatorios abren el chat con el mensaje
// escrito (click-to-send), no se mandan solos.

const CONTACTO = "contacto@codart.pe";

const FUNCIONALIDADES = [
  {
    icono: "📋",
    titulo: "Fichas clínicas a tu medida",
    texto:
      "Historia clínica, evaluaciones periódicas e informe de avance con los ítems que cada centro define en su propia plantilla. Sirve igual para terapia física que psicológica.",
  },
  {
    icono: "📅",
    titulo: "Agenda por terapeuta",
    texto:
      "Vista consolidada de horarios libres y ocupados de todo el equipo, con control de asistencia en cada sesión.",
  },
  {
    icono: "🎟️",
    titulo: "Paquetes de sesiones",
    texto:
      "Controla cuántas sesiones quedan y recibe el aviso de los paquetes por renovar antes de que se agoten.",
  },
  {
    icono: "💵",
    titulo: "Pagos y cobranza",
    texto:
      "Recibo interno imprimible, lista de pagos vencidos y por vencer, y descarga de todo en Excel cuando la necesites.",
  },
  {
    icono: "📈",
    titulo: "Seguimiento del progreso",
    texto:
      "Compara los informes de avance de un paciente y observa su evolución a lo largo del tratamiento.",
  },
  {
    icono: "🏢",
    titulo: "Varias sedes",
    texto:
      "Un centro con todas sus sedes en una cuenta, y permisos por rol para que cada quien vea lo que le toca.",
  },
];

const RAZONES = [
  {
    titulo: "Física o psicológica, tú decides",
    texto:
      "Las plantillas de las fichas se editan por centro, así que el sistema se adapta a tu forma de evaluar en vez de imponerte la suya.",
  },
  {
    titulo: "Tus datos, separados",
    texto:
      "Cada centro tiene su espacio aislado. Lo que registras no se cruza con el de ningún otro centro.",
  },
  {
    titulo: "En la web, sin instalar",
    texto:
      "Se entra desde el navegador, en computadora o celular. Sin servidores propios ni instalaciones.",
  },
];

export default async function PortadaPage() {
  const usuario = await getCurrentUser();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Cabecera ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#inicio" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 font-bold text-white">
              T
            </span>
            <span className="text-lg font-bold tracking-tight">Codart Terapias</span>
          </a>
          <div className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#funcionalidades" className="hover:text-slate-900">
              Funcionalidades
            </a>
            <a href="#porque" className="hover:text-slate-900">
              Por qué Codart
            </a>
            <a href="#contacto" className="hover:text-slate-900">
              Contacto
            </a>
          </div>
          <div className="flex items-center gap-3">
            {usuario ? (
              <Link
                href="/panel"
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                Ir al panel
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden text-sm font-medium text-slate-700 hover:text-slate-900 sm:inline"
                >
                  Iniciar sesión
                </Link>
                <a
                  href="#contacto"
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                >
                  Solicitar demo
                </a>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ── Portada ───────────────────────────────────────────────────────── */}
      <section id="inicio" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sky-50 to-white" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-medium text-sky-700">
            Para terapia física y psicológica
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            La gestión de tu centro,
            <br className="hidden sm:block" /> sin perder el hilo de ningún paciente
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Fichas clínicas que configuras a tu medida, agenda por terapeuta, paquetes de
            sesiones y control de pagos. Con todas tus sedes en una sola cuenta.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#contacto"
              className="w-full rounded-lg bg-sky-600 px-6 py-3 text-center font-semibold text-white shadow-sm hover:bg-sky-700 sm:w-auto"
            >
              Solicitar una demo
            </a>
            <Link
              href="/login"
              className="w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-center font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto"
            >
              Ya soy cliente
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Sin instalaciones · Se usa desde el navegador
          </p>
        </div>
      </section>

      {/* ── Funcionalidades ───────────────────────────────────────────────── */}
      <section id="funcionalidades" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Todo el centro, en un solo lugar
          </h2>
          <p className="mt-3 text-slate-600">
            Desde la primera evaluación del paciente hasta lo que queda por cobrar.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONALIDADES.map((f) => (
            <div
              key={f.titulo}
              className="rounded-2xl border border-slate-100 p-6 transition hover:border-sky-200 hover:shadow-sm"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-2xl">
                <span aria-hidden="true">{f.icono}</span>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Por qué ───────────────────────────────────────────────────────── */}
      <section id="porque" className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Pensado para tu centro</h2>
            <p className="mt-3 text-slate-600">
              El sistema se adapta a cómo trabajas, no al revés.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {RAZONES.map((r) => (
              <div key={r.titulo} className="text-center">
                <h3 className="font-semibold text-slate-900">{r.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contacto ──────────────────────────────────────────────────────── */}
      <section id="contacto" className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl bg-sky-600 px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight">¿Lo vemos con tu centro?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sky-50">
            Escríbenos y te mostramos el sistema funcionando, sin compromiso.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={`mailto:${CONTACTO}?subject=Quiero una demo de Codart Terapias`}
              className="w-full rounded-lg bg-white px-6 py-3 text-center font-semibold text-sky-700 hover:bg-sky-50 sm:w-auto"
            >
              Escribir a {CONTACTO}
            </a>
            <Link
              href="/login"
              className="w-full rounded-lg border border-sky-300 px-6 py-3 text-center font-semibold text-white hover:bg-sky-700 sm:w-auto"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pie ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-xs font-bold text-white">
              T
            </span>
            <span className="font-semibold text-slate-700">Codart Terapias</span>
          </div>
          <p>
            <a href="https://codart.pe" className="hover:text-slate-700">
              Ver los otros sistemas de Codart
            </a>
          </p>
          <p>© {new Date().getFullYear()} Codart</p>
        </div>
      </footer>
    </div>
  );
}
