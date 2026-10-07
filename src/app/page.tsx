import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { CodartLogo } from "@/components/brand/codart-logo";
// Fotos de Unsplash (licencia libre, sin atribución obligatoria).
import fotoPortada from "./_fotos/portada.webp";
import fotoSesion from "./_fotos/sesion.webp";

// Portada pública de terapias.codart.pe. Vive fuera del grupo (app), así que no
// pasa por requireUser() y la ve cualquier visitante. El panel está en /panel.
//
// El texto describe solo lo que el sistema hace hoy. En particular, WhatsApp
// funciona como click-to-send: el sistema abre el chat con el mensaje escrito y
// la persona lo envía; no se manda nada solo. Tampoco se anuncia que la firma
// del terapeuta salga en los documentos impresos: por ahora solo se registra.

const FUNCIONALIDADES = [
  {
    icono: "📋",
    titulo: "Fichas clínicas a tu medida",
    texto:
      "Historia clínica, evaluación e informe de avance sobre plantillas que tu centro arma: agrega, quita y reordena campos y secciones. Sirve igual para terapia física que psicológica.",
  },
  {
    icono: "✏️",
    titulo: "Marcas sobre el cuerpo",
    texto:
      "Señala a mano alzada la zona del dolor sobre una silueta de frente y espalda, o sobre cualquier imagen que subas. Funciona con mouse, dedo o lápiz.",
  },
  {
    icono: "🩺",
    titulo: "De la evaluación al tratamiento",
    texto:
      "La evaluación cierra con el tratamiento sugerido: qué terapias, cuántas sesiones y con qué frecuencia. De ahí sale el paquete, sin volver a escribirlo.",
  },
  {
    icono: "📅",
    titulo: "Agenda por terapeuta",
    texto:
      "Horarios libres y ocupados de todo el equipo, terapias individuales o grupales con cupo, y feriados, vacaciones y refrigerios que bloquean la agenda solos.",
  },
  {
    icono: "🎟️",
    titulo: "Paquetes de sesiones",
    texto:
      "Un paquete con varias terapias, cada una con su terapeuta, a un solo precio. Reprograma sesiones, recibe el aviso de los que están por agotarse y renuévalos con el tratamiento de la evaluación.",
  },
  {
    icono: "📞",
    titulo: "Seguimiento de interesados",
    texto:
      "Quien llamó pidiendo información o vino a la evaluación y no volvió entra a una bandeja de pendientes por contactar, con el historial de cada llamada.",
  },
  {
    icono: "💬",
    titulo: "Recordatorios por WhatsApp",
    texto:
      "Recordatorios de cita, avisos de cobro y recibos: un clic abre WhatsApp con el mensaje ya escrito, listo para enviar.",
  },
  {
    icono: "💵",
    titulo: "Pagos y cobranza",
    texto:
      "Recibo imprimible, lista de pagos vencidos y por vencer, y descarga de todo en Excel cuando la necesites.",
  },
  {
    icono: "📈",
    titulo: "Seguimiento del progreso",
    texto:
      "Compara los informes de avance de un paciente y observa su evolución a lo largo del tratamiento.",
  },
  {
    icono: "🧑‍⚕️",
    titulo: "Acceso para cada terapeuta",
    texto:
      "Cada terapeuta entra con su usuario: ve su agenda y sus pacientes, registra asistencia, evaluaciones e informes, y guarda su firma digital. Tú decides qué más puede hacer.",
  },
  {
    icono: "🖨️",
    titulo: "Documentos con tu logo",
    texto:
      "Recibos, historias clínicas, evaluaciones e informes de avance salen con el logo de tu centro, listos para imprimir o guardar en PDF.",
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

// Precios mensuales en soles, sin IGV. Misma estructura que landingchat.codart.pe
// (mensualidad + implementación única, pago por transferencia/Yape/Plin). Todos
// los planes traen todas las funcionalidades: solo cambian sedes y terapeutas.
const PLANES = [
  {
    nombre: "Consultorio",
    precio: 129,
    implementacion: 290,
    para: "Para el terapeuta independiente o el consultorio pequeño.",
    incluye: [
      "1 sede",
      "Hasta 3 terapeutas",
      "Pacientes ilimitados",
      "Todas las funcionalidades",
    ],
  },
  {
    nombre: "Centro",
    precio: 249,
    implementacion: 490,
    destacado: true,
    para: "Para el centro con un equipo de terapeutas en marcha.",
    incluye: [
      "1 sede",
      "Hasta 10 terapeutas",
      "Pacientes ilimitados",
      "Todas las funcionalidades",
    ],
  },
  {
    nombre: "Multisede",
    precio: 449,
    implementacion: 890,
    para: "Para el centro que atiende en varios locales.",
    incluye: [
      "Hasta 3 sedes (sede adicional S/ 79/mes)",
      "Hasta 30 terapeutas",
      "Pacientes ilimitados",
      "Soporte prioritario",
    ],
  },
];

export default async function PortadaPage() {
  const usuario = await getCurrentUser();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Cabecera ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#inicio" className="flex items-center gap-3">
            <CodartLogo className="h-7 w-auto" />
            <span className="hidden border-l border-slate-200 pl-3 text-sm font-medium text-slate-500 sm:inline">
              Terapias
            </span>
          </a>
          <div className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#funcionalidades" className="hover:text-slate-900">
              Funcionalidades
            </a>
            <a href="#porque" className="hover:text-slate-900">
              Por qué Codart
            </a>
            <a href="#precios" className="hover:text-slate-900">
              Precios
            </a>
            <a href="#contacto" className="hover:text-slate-900">
              Contacto
            </a>
          </div>
          <div className="flex items-center gap-3">
            {usuario ? (
              <Link
                href="/panel"
                className="rounded-lg bg-codart-600 px-4 py-2 text-sm font-medium text-white hover:bg-codart-700"
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
                  className="rounded-lg bg-codart-600 px-4 py-2 text-sm font-medium text-white hover:bg-codart-700"
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
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-codart-50 to-white" />
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pt-20 pb-16 lg:grid-cols-2 lg:items-center">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-codart-200 bg-white px-3 py-1 text-xs font-medium text-codart-700">
              Para terapia física y psicológica
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              La gestión de tu centro,
              <br className="hidden sm:block lg:hidden" /> sin perder el hilo de ningún paciente
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 lg:mx-0">
              Fichas clínicas que configuras a tu medida, agenda por terapeuta, paquetes de
              sesiones, seguimiento de interesados y control de pagos. Con todas tus sedes
              en una sola cuenta.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <a
                href="#contacto"
                className="w-full rounded-lg bg-codart-600 px-6 py-3 text-center font-semibold text-white shadow-sm hover:bg-codart-700 sm:w-auto"
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
          <Image
            src={fotoPortada}
            alt="Una terapeuta física trabaja la rodilla de un paciente en la camilla"
            preload
            sizes="(min-width: 1024px) 560px, (min-width: 640px) 576px, 100vw"
            className="mx-auto aspect-[16/10] w-full max-w-xl rounded-3xl object-cover shadow-xl lg:aspect-[4/3]"
          />
        </div>
      </section>

      {/* ── Funcionalidades ───────────────────────────────────────────────── */}
      <section id="funcionalidades" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Todo el centro, en un solo lugar
          </h2>
          <p className="mt-3 text-slate-600">
            Desde la primera llamada del interesado hasta lo que queda por cobrar.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCIONALIDADES.map((f) => (
            <div
              key={f.titulo}
              className="rounded-2xl border border-slate-100 p-6 transition hover:border-codart-200 hover:shadow-sm"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-codart-50 text-2xl">
                <span aria-hidden="true">{f.icono}</span>
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{f.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Por qué ───────────────────────────────────────────────────────── */}
      <section id="porque" className="scroll-mt-16 border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Pensado para tu centro</h2>
            <p className="mt-3 text-slate-600">
              El sistema se adapta a cómo trabajas, no al revés.
            </p>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-center">
            <Image
              src={fotoSesion}
              alt="Sesión de terapia psicológica: la terapeuta toma notas mientras escucha a su paciente"
              sizes="(min-width: 1024px) 560px, 100vw"
              className="aspect-[16/10] w-full rounded-3xl object-cover shadow-lg lg:aspect-[4/3]"
            />
            <div className="grid gap-8">
              {RAZONES.map((r) => (
                <div key={r.titulo} className="border-l-4 border-codart-200 pl-5">
                  <h3 className="font-semibold text-slate-900">{r.titulo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{r.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Precios ───────────────────────────────────────────────────────── */}
      <section id="precios" className="mx-auto max-w-6xl scroll-mt-16 px-6 pt-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Planes y precios</h2>
          <p className="mt-3 text-slate-600">
            Precios mensuales en soles, sin IGV. Todos los planes incluyen todas las
            funcionalidades; solo cambia el tamaño de tu centro.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANES.map((p) => (
            <div
              key={p.nombre}
              className={
                p.destacado
                  ? "relative flex flex-col rounded-2xl border-2 border-codart-600 p-7 shadow-lg"
                  : "relative flex flex-col rounded-2xl border border-slate-200 p-7"
              }
            >
              {p.destacado && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-codart-600 px-3 py-1 text-xs font-semibold text-white">
                  El más elegido
                </span>
              )}
              <h3 className="text-lg font-semibold text-slate-900">{p.nombre}</h3>
              <p className="mt-1 text-sm text-slate-500">{p.para}</p>
              <p className="mt-6">
                <span className="text-4xl font-extrabold tracking-tight">S/ {p.precio}</span>
                <span className="text-sm text-slate-500"> /mes sin IGV</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Implementación única: S/ {p.implementacion}
              </p>
              <ul className="mt-6 grid flex-1 content-start gap-3 text-sm text-slate-700">
                {p.incluye.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="font-bold text-codart-600">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="#contacto"
                className={
                  p.destacado
                    ? "mt-8 rounded-lg bg-codart-600 px-5 py-3 text-center font-semibold text-white hover:bg-codart-700"
                    : "mt-8 rounded-lg border border-slate-300 px-5 py-3 text-center font-semibold text-slate-800 hover:bg-slate-50"
                }
              >
                Solicitar una demo
              </a>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-3xl space-y-2 text-center text-sm text-slate-500">
          <p>
            La implementación toma de 3 a 5 días hábiles e incluye crear tus sedes y usuarios,
            configurar las plantillas de tus fichas clínicas y capacitar a tu equipo.
          </p>
          <p>
            Usuarios administrativos sin límite. Pago por transferencia, Yape o Plin. Sin
            contratos de permanencia.
          </p>
        </div>
      </section>

      {/* ── Contacto ──────────────────────────────────────────────────────── */}
      <section id="contacto" className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl bg-codart-600 px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight">¿Lo vemos con tu centro?</h2>
          <p className="mx-auto mt-3 max-w-xl text-codart-50">
            Escríbenos y te mostramos el sistema funcionando, sin compromiso.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="https://codart.pe/contacto/?producto=terapias"
              className="w-full rounded-lg bg-white px-6 py-3 text-center font-semibold text-codart-700 hover:bg-codart-50 sm:w-auto"
            >
              Solicitar una demo
            </a>
            <Link
              href="/login"
              className="w-full rounded-lg border border-codart-300 px-6 py-3 text-center font-semibold text-white hover:bg-codart-700 sm:w-auto"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pie ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-3">
            <CodartLogo className="h-6 w-auto" />
            <span className="border-l border-slate-200 pl-3 font-medium text-slate-500">Terapias</span>
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
