// Datos de demostración para mostrar el sistema a clientes potenciales.
//
//   npm run demo
//
// Es idempotente: borra los datos operativos de los centros demo y los vuelve
// a crear con fechas relativas a HOY, de modo que las pantallas siempre tengan
// pagos vencidos, paquetes por renovar y una agenda con horas libres y ocupadas.
// NUNCA se ejecuta con NODE_ENV=production: borra datos.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

process.loadEnvFile?.();

if (process.env.NODE_ENV === "production") {
  throw new Error("prisma/demo.ts borra datos: no se ejecuta en producción.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CLAVE_DEMO = "demo123";

/* ── Fechas ──────────────────────────────────────────────── */

/** Hoy a medianoche local (convención de los campos "solo fecha"). */
function hoy(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Medianoche local de hoy + n días. */
function dia(n: number): Date {
  const d = hoy();
  d.setDate(d.getDate() + n);
  return d;
}

/** Mediodía local: los pagos se guardan así (evita desfases de zona). */
function mediodia(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x;
}

function claveFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function sumarMinutos(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/* ── Sesiones ────────────────────────────────────────────── */

type Franja = { dia: number; hora: string }; // dia: getDay() 0=Dom..6=Sáb

/** Fechas de las N sesiones desde `inicio`, repitiendo el horario semanal. */
function generarSesiones(inicio: Date, total: number, horario: Franja[], duracionMin: number) {
  const porDia = new Map(horario.map((h) => [h.dia, h.hora]));
  const out: { fecha: Date; horaInicio: string; horaFin: string }[] = [];
  const cursor = new Date(inicio);
  let guardia = 0;
  while (out.length < total && guardia < total * 14 + 60) {
    const hora = porDia.get(cursor.getDay());
    if (hora) {
      out.push({
        fecha: new Date(cursor),
        horaInicio: hora,
        horaFin: sumarMinutos(hora, duracionMin),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
    guardia++;
  }
  return out;
}

/** Misma regla que src/app/(app)/pagos/cobranza.ts, para autocomprobar el guion. */
function estadoCobroEsperado(
  inicio: Date,
  fin: Date,
  saldo: number,
  porcentaje = 50,
  diasAviso = 7,
): "vencido" | "por-vencer" | null {
  if (!(saldo > 0)) return null;
  const gracia = Math.ceil((porcentaje * Math.max(0, diasEntre(inicio, fin))) / 100);
  const limite = diasEntre(hoy(), inicio) + gracia - 1; // días desde hoy
  if (limite < 0) return "vencido";
  if (limite <= diasAviso) return "por-vencer";
  return null;
}

/* ── Catálogo de personas ────────────────────────────────── */

const APODERADOS = [
  { nombres: "Rosa", apellidos: "Ríos Palomino", vinculo: "MADRE" as const },
  { nombres: "Carlos", apellidos: "Quispe Mendoza", vinculo: "PADRE" as const },
  { nombres: "Elena", apellidos: "Soto Vargas", vinculo: "MADRE" as const },
  { nombres: "Miguel", apellidos: "Lara Bustos", vinculo: "PADRE" as const },
];

/** Teléfonos ficticios (9 dígitos, prefijo 9) para el botón de WhatsApp. */
function telefono(i: number): string {
  return `9${String(11223344 + i * 137).padStart(8, "0")}`;
}

async function main() {
  console.log("Sembrando datos de demostración…\n");

  /* ══ Centro principal de demo: Arcoíris ══════════════════ */

  const centro = await prisma.centro.upsert({
    where: { codigo: "arcoiris" },
    update: { nombre: "Centro Arcoíris", subtitulo: "Terapias de lenguaje y aprendizaje" },
    create: {
      codigo: "arcoiris",
      nombre: "Centro Arcoíris",
      subtitulo: "Terapias de lenguaje y aprendizaje",
    },
  });

  // Dos sedes: la demo del cambio de sede y del aislamiento de datos.
  const principal = await prisma.sede.upsert({
    where: { centroId_nombre: { centroId: centro.id, nombre: "Principal" } },
    update: {},
    create: { centroId: centro.id, nombre: "Principal" },
  });
  const sjl = await prisma.sede.upsert({
    where: { centroId_nombre: { centroId: centro.id, nombre: "San Juan de Lurigancho" } },
    update: {},
    create: { centroId: centro.id, nombre: "San Juan de Lurigancho" },
  });

  // Jornada amplia con refrigerio: así la vista consolidada de la agenda
  // muestra bloques libres, ocupados y la franja de refrigerio.
  for (const s of [principal, sjl]) {
    await prisma.sede.update({
      where: { id: s.id },
      data: {
        direccion:
          s.nombre === "Principal" ? "Av. Los Álamos 452, Lima" : "Av. Próceres 1180, SJL",
        telefono: s.nombre === "Principal" ? "01 555 4120" : "01 555 7788",
        horaApertura: "08:00",
        horaCierre: "18:00",
        refrigerioInicio: "13:00",
        refrigerioFin: "14:00",
        diasLaborales: [1, 2, 3, 4, 5, 6],
        intervaloCalendario: 15,
        intervalosCalendario: [15, 30, 45, 60],
      },
    });
  }

  /* ── Limpieza de los datos operativos del centro ────────── */
  const sedeIds = [principal.id, sjl.id];
  await prisma.observacionSesion.deleteMany({ where: { cita: { sedeId: { in: sedeIds } } } });
  await prisma.pago.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.cita.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.paquete.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.interaccion.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.evaluacion.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.historiaClinica.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.informeAvance.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.apoderado.deleteMany({ where: { paciente: { sedeId: { in: sedeIds } } } });
  await prisma.paciente.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.terapeuta.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.programaTerapia.deleteMany({ where: { sedeId: { in: sedeIds } } });
  await prisma.feriado.deleteMany({ where: { sedeId: { in: sedeIds } } });

  /* ── Criterio de cobranza del centro (el 50 % del ejemplo) ── */
  await prisma.configuracion.upsert({
    where: { centroId: centro.id },
    update: { graciaTipo: "PORCENTAJE", graciaValor: 50, diasAvisoCobro: 7 },
    create: {
      centroId: centro.id,
      graciaTipo: "PORCENTAJE",
      graciaValor: 50,
      diasAvisoCobro: 7,
    },
  });

  /* ── Usuarios (un rol de cada uno para mostrar permisos) ── */
  const hash = await bcrypt.hash(CLAVE_DEMO, 10);
  const admin = await prisma.user.upsert({
    where: { centroId_usuario: { centroId: centro.id, usuario: "admin" } },
    update: { passwordHash: hash, nombre: "Patricia La Rosa", rol: "ADMINISTRADOR", activo: true },
    create: {
      centroId: centro.id,
      nombre: "Patricia La Rosa",
      usuario: "admin",
      passwordHash: hash,
      rol: "ADMINISTRADOR",
    },
  });
  const coord = await prisma.user.upsert({
    where: { centroId_usuario: { centroId: centro.id, usuario: "coordinadora" } },
    update: { passwordHash: hash, rol: "COORDINADOR", activo: true },
    create: {
      centroId: centro.id,
      nombre: "Lucía Benites",
      usuario: "coordinadora",
      passwordHash: hash,
      rol: "COORDINADOR",
    },
  });
  const recepcion = await prisma.user.upsert({
    where: { centroId_usuario: { centroId: centro.id, usuario: "recepcion" } },
    update: { passwordHash: hash, rol: "USUARIO", activo: true },
    create: {
      centroId: centro.id,
      nombre: "Mesa de partes",
      usuario: "recepcion",
      passwordHash: hash,
      rol: "USUARIO",
    },
  });
  // Coordinadora: ambas sedes. Recepción: solo la principal.
  await prisma.userSede.deleteMany({ where: { userId: { in: [coord.id, recepcion.id] } } });
  await prisma.userSede.createMany({
    data: [
      { userId: coord.id, sedeId: principal.id },
      { userId: coord.id, sedeId: sjl.id },
      { userId: recepcion.id, sedeId: principal.id },
    ],
  });
  void admin;

  /* ── Programas (definen la duración de la sesión) ───────── */
  const programas: Record<string, { id: string; duracionMin: number }> = {};
  for (const sede of [principal, sjl]) {
    for (const p of [
      { nombre: "Terapia de lenguaje", duracionMin: 45, maxPacientes: 1 },
      { nombre: "Terapia ocupacional", duracionMin: 45, maxPacientes: 1 },
      { nombre: "Psicopedagogía", duracionMin: 60, maxPacientes: 1 },
      { nombre: "Taller de socialización", duracionMin: 60, maxPacientes: 4 },
    ]) {
      const creado = await prisma.programaTerapia.create({
        data: { ...p, sedeId: sede.id },
      });
      programas[`${sede.id}|${p.nombre}`] = { id: creado.id, duracionMin: p.duracionMin };
    }
  }

  /* ── Terapeutas ─────────────────────────────────────────── */
  const [ana, luis, carmen] = await Promise.all([
    prisma.terapeuta.create({
      data: {
        sedeId: principal.id,
        nombres: "Ana",
        apellidos: "Ramírez Cueva",
        especialidad: "Terapia de lenguaje",
        telefono: telefono(90),
      },
    }),
    prisma.terapeuta.create({
      data: {
        sedeId: principal.id,
        nombres: "Luis",
        apellidos: "Torres Aguilar",
        especialidad: "Terapia ocupacional",
        telefono: telefono(91),
      },
    }),
    prisma.terapeuta.create({
      data: {
        sedeId: principal.id,
        nombres: "Carmen",
        apellidos: "Vega Ponce",
        especialidad: "Psicopedagogía",
        telefono: telefono(92),
      },
    }),
  ]);
  const [rocio, jorge] = await Promise.all([
    prisma.terapeuta.create({
      data: {
        sedeId: sjl.id,
        nombres: "Rocío",
        apellidos: "Salazar Pinto",
        especialidad: "Terapia de lenguaje",
        telefono: telefono(93),
      },
    }),
    prisma.terapeuta.create({
      data: {
        sedeId: sjl.id,
        nombres: "Jorge",
        apellidos: "Campos Neyra",
        especialidad: "Terapia ocupacional",
        telefono: telefono(94),
      },
    }),
  ]);

  /* ── Feriado de la próxima semana (se ve en la agenda) ──── */
  const feriado = dia(9).getDay() === 0 ? dia(10) : dia(9);
  for (const s of [principal, sjl]) {
    await prisma.feriado.create({
      data: { sedeId: s.id, fecha: feriado, descripcion: "Aniversario del centro" },
    });
  }

  /* ── Pacientes con paquete, sesiones y pagos ─────────────── */

  type Caso = {
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    dni: string;
    nacido: number; // años
    sexo: "M" | "F";
    diagnostico: string;
    programa: "Terapia de lenguaje" | "Terapia ocupacional" | "Psicopedagogía" | "Taller de socialización";
    terapeutaId: string;
    horario: Franja[];
    total: number;
    precio: number;
    inicioHace: number; // días antes de hoy en que empezó el paquete
    /** Pagos del paquete: [monto, días antes de hoy, método]. */
    pagos: [number, number, "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA" | "TARJETA"][];
    estado?: "ACTIVO" | "COMPLETADO" | "ANULADO";
    /** Deja las últimas N sesiones sin registrar asistencia (quedan pendientes). */
    nota?: string;
  };

  // Horarios pensados para que Ana tenga bloques contiguos (9:00, 9:45, 10:30)
  // y huecos: así la vista consolidada se ve interesante.
  const L_X_V = (hora: string): Franja[] => [
    { dia: 1, hora },
    { dia: 3, hora },
    { dia: 5, hora },
  ];
  const M_J = (hora: string): Franja[] => [
    { dia: 2, hora },
    { dia: 4, hora },
  ];

  const casos: Caso[] = [
    // 1. COMPLETADO pero con deuda: sale en Cobranza (vencido) aunque terminó.
    {
      nombres: "Mateo", apellidoPaterno: "Quispe", apellidoMaterno: "Ríos", dni: "71234567",
      nacido: 7, sexo: "M", diagnostico: "Retraso simple del lenguaje",
      programa: "Terapia de lenguaje", terapeutaId: ana.id, horario: L_X_V("09:00"),
      total: 12, precio: 960, inicioHace: 70,
      pagos: [[300, 68, "YAPE"]],
      estado: "COMPLETADO",
      nota: "Quedó saldo pendiente al cerrar el paquete.",
    },
    // 2. Vencido y además por renovar pronto (sigue en curso).
    {
      nombres: "Valentina", apellidoPaterno: "Huamán", apellidoMaterno: "Soto", dni: "71234568",
      nacido: 6, sexo: "F", diagnostico: "Trastorno fonológico",
      programa: "Terapia de lenguaje", terapeutaId: ana.id, horario: L_X_V("09:45"),
      total: 16, precio: 1120, inicioHace: 38,
      pagos: [[400, 36, "EFECTIVO"], [200, 15, "PLIN"]],
    },
    // 3. Por vencer: el plazo se cumple en estos días.
    {
      nombres: "Thiago", apellidoPaterno: "Mendoza", apellidoMaterno: "Lara", dni: "71234569",
      nacido: 8, sexo: "M", diagnostico: "TDAH",
      programa: "Psicopedagogía", terapeutaId: carmen.id, horario: M_J("10:00"),
      total: 12, precio: 840, inicioHace: 13,
      pagos: [[300, 12, "TRANSFERENCIA"]],
    },
    // 4. Por vencer, sin ningún pago todavía.
    {
      nombres: "Luciana", apellidoPaterno: "Paredes", apellidoMaterno: "Ríos", dni: "71234570",
      nacido: 5, sexo: "F", diagnostico: "Retraso del desarrollo psicomotor",
      programa: "Terapia ocupacional", terapeutaId: luis.id, horario: L_X_V("11:00"),
      total: 12, precio: 720, inicioHace: 10,
      pagos: [],
    },
    // 5. Al día: pagado completo, no aparece en Cobranza.
    {
      nombres: "Santiago", apellidoPaterno: "Flores", apellidoMaterno: "Núñez", dni: "71234571",
      nacido: 9, sexo: "M", diagnostico: "Dislexia",
      programa: "Psicopedagogía", terapeutaId: carmen.id, horario: M_J("11:30"),
      total: 12, precio: 840, inicioHace: 20,
      pagos: [[440, 20, "TARJETA"], [400, 6, "YAPE"]],
    },
    // 6. Por renovar (ya terminó): todas las sesiones con asistencia registrada.
    {
      nombres: "Emma", apellidoPaterno: "Castillo", apellidoMaterno: "Vargas", dni: "71234572",
      nacido: 6, sexo: "F", diagnostico: "Dificultades articulatorias",
      programa: "Terapia de lenguaje", terapeutaId: ana.id, horario: L_X_V("10:30"),
      total: 12, precio: 720, inicioHace: 33,
      pagos: [[720, 33, "EFECTIVO"]],
    },
    // 7. Por renovar (termina en pocos días).
    {
      nombres: "Gael", apellidoPaterno: "Rojas", apellidoMaterno: "Chávez", dni: "71234573",
      nacido: 7, sexo: "M", diagnostico: "Trastorno del espectro autista (nivel 1)",
      programa: "Terapia ocupacional", terapeutaId: luis.id, horario: L_X_V("12:00"),
      total: 12, precio: 720, inicioHace: 24,
      pagos: [[720, 24, "TRANSFERENCIA"]],
    },
    // 8. En curso y al corriente del plazo: ni vencido ni por renovar.
    {
      nombres: "Isabella", apellidoPaterno: "Romero", apellidoMaterno: "Díaz", dni: "71234574",
      nacido: 4, sexo: "F", diagnostico: "Retraso del lenguaje expresivo",
      programa: "Terapia de lenguaje", terapeutaId: ana.id, horario: M_J("09:00"),
      total: 16, precio: 1120, inicioHace: 5,
      pagos: [[560, 5, "YAPE"]],
    },
    // 9. Anulado con saldo: NO debe aparecer en Cobranza.
    {
      nombres: "Dylan", apellidoPaterno: "Sánchez", apellidoMaterno: "Peña", dni: "71234575",
      nacido: 10, sexo: "M", diagnostico: "Dificultades de atención",
      programa: "Psicopedagogía", terapeutaId: carmen.id, horario: M_J("16:00"),
      total: 12, precio: 840, inicioHace: 50,
      pagos: [[100, 49, "EFECTIVO"]],
      estado: "ANULADO",
      nota: "La familia se mudó de distrito.",
    },
  ];

  const resumen: string[] = [];
  let pacienteIdx = 0;

  for (const c of casos) {
    pacienteIdx++;
    const prog = programas[`${principal.id}|${c.programa}`];
    const nacimiento = new Date();
    nacimiento.setFullYear(nacimiento.getFullYear() - c.nacido, 3, 12);
    nacimiento.setHours(0, 0, 0, 0);

    const ap = APODERADOS[pacienteIdx % APODERADOS.length];
    const paciente = await prisma.paciente.create({
      data: {
        sedeId: principal.id,
        nombres: c.nombres,
        apellidoPaterno: c.apellidoPaterno,
        apellidoMaterno: c.apellidoMaterno,
        dni: c.dni,
        fechaNacimiento: nacimiento,
        sexo: c.sexo,
        telefono: telefono(pacienteIdx),
        direccion: "Calle Las Gardenias 123",
        distrito: "San Borja",
        programa: "TERAPIAS",
        diagnostico: c.diagnostico,
        estado: "ACTIVO",
        apoderados: {
          create: {
            nombres: ap.nombres,
            apellidos: ap.apellidos,
            dni: `0${8000000 + pacienteIdx}`,
            telefono: telefono(pacienteIdx + 20),
            correo: `${ap.nombres.toLowerCase()}.${c.apellidoPaterno.toLowerCase()}@example.com`,
            vinculo: ap.vinculo,
            principal: true,
          },
        },
      },
    });

    const inicio = dia(-c.inicioHace);
    const sesiones = generarSesiones(inicio, c.total, c.horario, prog.duracionMin);
    const fechaInicio = sesiones[0].fecha;
    const fechaFin = sesiones[sesiones.length - 1].fecha;

    const paquete = await prisma.paquete.create({
      data: {
        sedeId: principal.id,
        pacienteId: paciente.id,
        programaId: prog.id,
        totalSesiones: c.total,
        frecuenciaSemana: c.horario.length,
        horarioSemanal: c.horario.map((h) => ({ dia: h.dia, hora: h.hora })),
        precio: c.precio,
        fechaInicio,
        fechaFin,
        estado: c.estado ?? "ACTIVO",
        observacion: c.nota ?? null,
      },
    });

    // Sesiones pasadas: asistencia registrada (una falta y una tardanza sueltas).
    const hoyClave = claveFecha(hoy());
    await prisma.cita.createMany({
      data: sesiones.map((s, i) => {
        const pasada = claveFecha(s.fecha) < hoyClave;
        const anulado = c.estado === "ANULADO";
        const asistencia = !pasada || anulado
          ? ("PENDIENTE" as const)
          : i % 9 === 4
            ? ("FALTO" as const)
            : i % 7 === 5
              ? ("TARDANZA" as const)
              : ("ASISTIO" as const);
        const estado = anulado
          ? ("CANCELADA" as const)
          : asistencia === "PENDIENTE"
            ? ("AGENDADA" as const)
            : asistencia === "FALTO"
              ? ("CANCELADA" as const)
              : ("ATENDIDA" as const);
        return {
          sedeId: principal.id,
          pacienteId: paciente.id,
          terapeutaId: c.terapeutaId,
          paqueteId: paquete.id,
          numeroSesion: i + 1,
          fecha: s.fecha,
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          tipo: "SESION" as const,
          estado,
          asistencia,
          terapiaRealizada:
            asistencia === "ASISTIO" ? "Ejercicios de praxias y vocabulario." : null,
        };
      }),
    });

    // Pagos del paquete, con el correlativo y el saldo que calcularía la app.
    let pagadoAcum = 0;
    for (const [monto, hace, metodo] of c.pagos) {
      pagadoAcum += monto;
      const saldo = Math.max(0, Math.round((c.precio - pagadoAcum) * 100) / 100);
      await crearPago({
        sedeId: principal.id,
        sedeNombre: principal.nombre,
        pacienteId: paciente.id,
        paqueteId: paquete.id,
        concepto: "PAQUETE_SESIONES",
        monto,
        saldo,
        metodoPago: metodo,
        fecha: dia(-hace),
        descripcion: `Paquete de ${c.total} sesiones · ${c.programa}`,
      });
    }

    const saldoFinal = Math.round((c.precio - pagadoAcum) * 100) / 100;
    const cobro =
      c.estado === "ANULADO"
        ? "(anulado, fuera de cobranza)"
        : (estadoCobroEsperado(fechaInicio, fechaFin, saldoFinal) ?? "al día");
    resumen.push(
      `  ${c.nombres} ${c.apellidoPaterno}: ${c.estado ?? "ACTIVO"} · saldo S/ ${saldoFinal} · cobranza: ${cobro} · última sesión ${claveFecha(fechaFin)}`,
    );
  }

  /* ── Camila: paquete renovado (el viejo NO debe avisar) ──── */
  const camila = await prisma.paciente.create({
    data: {
      sedeId: principal.id,
      nombres: "Camila",
      apellidoPaterno: "Torres",
      apellidoMaterno: "Vega",
      dni: "71234580",
      fechaNacimiento: new Date(new Date().getFullYear() - 8, 6, 3),
      sexo: "F",
      telefono: telefono(31),
      distrito: "Surco",
      programa: "TERAPIAS",
      diagnostico: "Trastorno mixto del lenguaje",
      estado: "ACTIVO",
      apoderados: {
        create: {
          nombres: "Sandra",
          apellidos: "Vega Loayza",
          telefono: telefono(32),
          vinculo: "MADRE",
          principal: true,
        },
      },
    },
  });
  const progLenguaje = programas[`${principal.id}|Terapia de lenguaje`];
  for (const [idx, cfg] of [
    { inicioHace: 40, total: 12, precio: 720, hora: "15:00" },
    { inicioHace: 4, total: 12, precio: 780, hora: "15:00" },
  ].entries()) {
    const ses = generarSesiones(dia(-cfg.inicioHace), cfg.total, L_X_V(cfg.hora), progLenguaje.duracionMin);
    const paq = await prisma.paquete.create({
      data: {
        sedeId: principal.id,
        pacienteId: camila.id,
        programaId: progLenguaje.id,
        totalSesiones: cfg.total,
        frecuenciaSemana: 3,
        horarioSemanal: L_X_V(cfg.hora).map((h) => ({ dia: h.dia, hora: h.hora })),
        precio: cfg.precio,
        fechaInicio: ses[0].fecha,
        fechaFin: ses[ses.length - 1].fecha,
        estado: "ACTIVO",
        observacion: idx === 0 ? "Paquete anterior, ya renovado." : "Renovación.",
      },
    });
    const hoyClave = claveFecha(hoy());
    await prisma.cita.createMany({
      data: ses.map((s, i) => {
        const pasada = claveFecha(s.fecha) < hoyClave;
        return {
          sedeId: principal.id,
          pacienteId: camila.id,
          terapeutaId: ana.id,
          paqueteId: paq.id,
          numeroSesion: i + 1,
          fecha: s.fecha,
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          tipo: "SESION" as const,
          estado: pasada ? ("ATENDIDA" as const) : ("AGENDADA" as const),
          asistencia: pasada ? ("ASISTIO" as const) : ("PENDIENTE" as const),
        };
      }),
    });
    await crearPago({
      sedeId: principal.id,
      sedeNombre: principal.nombre,
      pacienteId: camila.id,
      paqueteId: paq.id,
      concepto: "PAQUETE_SESIONES",
      monto: cfg.precio,
      saldo: 0,
      metodoPago: idx === 0 ? "EFECTIVO" : "YAPE",
      fecha: dia(-cfg.inicioHace),
      descripcion: `Paquete de ${cfg.total} sesiones`,
    });
  }

  /* ── Interesados: bandeja de seguimiento ─────────────────── */
  for (const i of [
    { nombres: "Matías", apellidoPaterno: "Guerrero", apellidoMaterno: "Luna", canal: "LLAMADA" as const, hace: 2 },
    { nombres: "Sofía", apellidoPaterno: "Ramos", apellidoMaterno: "Ibáñez", canal: "WHATSAPP" as const, hace: 5 },
    { nombres: "Adriano", apellidoPaterno: "Cabrera", apellidoMaterno: "Solís", canal: "VISITA" as const, hace: 9 },
  ]) {
    const p = await prisma.paciente.create({
      data: {
        sedeId: principal.id,
        nombres: i.nombres,
        apellidoPaterno: i.apellidoPaterno,
        apellidoMaterno: i.apellidoMaterno,
        telefono: telefono(40 + i.hace),
        programa: "TERAPIAS",
        estado: "ACTIVO",
        diagnostico: "Por evaluar",
      },
    });
    await prisma.interaccion.create({
      data: {
        sedeId: principal.id,
        pacienteId: p.id,
        direccion: "ENTRADA",
        canal: i.canal,
        fecha: mediodia(dia(-i.hace)),
        nota: "Consulta por terapia de lenguaje. Pidió información de precios.",
        autor: "Lucía Benites",
      },
    });
  }

  /* ── Citas sueltas de esta semana (consultas y evaluaciones) ── */
  const lunes = (() => {
    const d = hoy();
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    return d;
  })();
  const sueltas = [
    { offset: 0, hora: "14:00", tipo: "EVALUACION" as const, terapeuta: ana.id },
    { offset: 1, hora: "15:30", tipo: "CONSULTA" as const, terapeuta: ana.id },
    { offset: 2, hora: "16:00", tipo: "EVALUACION" as const, terapeuta: luis.id },
    { offset: 4, hora: "14:30", tipo: "CONSULTA" as const, terapeuta: carmen.id },
  ];
  const pacientesSueltos = await prisma.paciente.findMany({
    where: { sedeId: principal.id },
    take: 4,
    select: { id: true },
  });
  for (const [i, s] of sueltas.entries()) {
    const f = new Date(lunes);
    f.setDate(f.getDate() + s.offset);
    await prisma.cita.create({
      data: {
        sedeId: principal.id,
        pacienteId: pacientesSueltos[i % pacientesSueltos.length].id,
        terapeutaId: s.terapeuta,
        fecha: f,
        horaInicio: s.hora,
        horaFin: sumarMinutos(s.hora, 45),
        tipo: s.tipo,
        estado: "AGENDADA",
        asistencia: "PENDIENTE",
      },
    });
  }

  /* ── Pagos sueltos (matrículas, materiales, evaluaciones) ── */
  const todosPrincipal = await prisma.paciente.findMany({
    where: { sedeId: principal.id },
    select: { id: true },
  });
  const sueltosPagos: [number, number, "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA" | "TARJETA", "MATRICULA" | "MATERIALES" | "EVALUACION" | "MENSUALIDAD"][] = [
    [150, 75, "EFECTIVO", "MATRICULA"],
    [150, 62, "YAPE", "MATRICULA"],
    [80, 55, "PLIN", "MATERIALES"],
    [200, 48, "TRANSFERENCIA", "EVALUACION"],
    [150, 40, "EFECTIVO", "MATRICULA"],
    [80, 33, "YAPE", "MATERIALES"],
    [200, 27, "TARJETA", "EVALUACION"],
    [350, 20, "TRANSFERENCIA", "MENSUALIDAD"],
    [150, 14, "EFECTIVO", "MATRICULA"],
    [80, 8, "YAPE", "MATERIALES"],
    [200, 3, "PLIN", "EVALUACION"],
    [350, 1, "EFECTIVO", "MENSUALIDAD"],
  ];
  for (const [i, [monto, hace, metodo, concepto]] of sueltosPagos.entries()) {
    await crearPago({
      sedeId: principal.id,
      sedeNombre: principal.nombre,
      pacienteId: todosPrincipal[i % todosPrincipal.length].id,
      paqueteId: null,
      concepto,
      monto,
      saldo: 0,
      metodoPago: metodo,
      fecha: dia(-hace),
    });
  }

  /* ── Sede SJL: menos datos, para mostrar el cambio de sede ── */
  const sjlCasos = [
    { nombres: "Fabiana", apellidoPaterno: "Ochoa", apellidoMaterno: "Zárate", terapeutaId: rocio.id, hora: "09:00", inicioHace: 30, precio: 720, pagado: 250 },
    { nombres: "Bruno", apellidoPaterno: "Alarcón", apellidoMaterno: "Meza", terapeutaId: jorge.id, hora: "10:00", inicioHace: 12, precio: 720, pagado: 720 },
    { nombres: "Renata", apellidoPaterno: "Villanueva", apellidoMaterno: "Pino", terapeutaId: rocio.id, hora: "11:00", inicioHace: 6, precio: 840, pagado: 0 },
  ];
  const progSjl = programas[`${sjl.id}|Terapia de lenguaje`];
  for (const [i, c] of sjlCasos.entries()) {
    const p = await prisma.paciente.create({
      data: {
        sedeId: sjl.id,
        nombres: c.nombres,
        apellidoPaterno: c.apellidoPaterno,
        apellidoMaterno: c.apellidoMaterno,
        dni: `7223456${i}`,
        fechaNacimiento: new Date(new Date().getFullYear() - 7, 1, 8),
        sexo: i % 2 === 0 ? "F" : "M",
        telefono: telefono(60 + i),
        distrito: "San Juan de Lurigancho",
        programa: "TERAPIAS",
        diagnostico: "Retraso del lenguaje",
        estado: "ACTIVO",
        apoderados: {
          create: {
            nombres: "Marta",
            apellidos: `${c.apellidoPaterno} Ruiz`,
            telefono: telefono(70 + i),
            vinculo: "MADRE",
            principal: true,
          },
        },
      },
    });
    const ses = generarSesiones(dia(-c.inicioHace), 12, L_X_V(c.hora), progSjl.duracionMin);
    const paq = await prisma.paquete.create({
      data: {
        sedeId: sjl.id,
        pacienteId: p.id,
        programaId: progSjl.id,
        totalSesiones: 12,
        frecuenciaSemana: 3,
        horarioSemanal: L_X_V(c.hora).map((h) => ({ dia: h.dia, hora: h.hora })),
        precio: c.precio,
        fechaInicio: ses[0].fecha,
        fechaFin: ses[ses.length - 1].fecha,
        estado: "ACTIVO",
      },
    });
    const hoyClave = claveFecha(hoy());
    await prisma.cita.createMany({
      data: ses.map((s, k) => {
        const pasada = claveFecha(s.fecha) < hoyClave;
        return {
          sedeId: sjl.id,
          pacienteId: p.id,
          terapeutaId: c.terapeutaId,
          paqueteId: paq.id,
          numeroSesion: k + 1,
          fecha: s.fecha,
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          tipo: "SESION" as const,
          estado: pasada ? ("ATENDIDA" as const) : ("AGENDADA" as const),
          asistencia: pasada ? ("ASISTIO" as const) : ("PENDIENTE" as const),
        };
      }),
    });
    if (c.pagado > 0) {
      await crearPago({
        sedeId: sjl.id,
        sedeNombre: sjl.nombre,
        pacienteId: p.id,
        paqueteId: paq.id,
        concepto: "PAQUETE_SESIONES",
        monto: c.pagado,
        saldo: Math.max(0, c.precio - c.pagado),
        metodoPago: "EFECTIVO",
        fecha: dia(-c.inicioHace),
      });
    }
  }

  /* ── Segundo centro: criterio por DÍAS, para contrastar ──── */
  const otro = await prisma.centro.findUnique({ where: { codigo: "demo" } });
  if (otro) {
    await prisma.configuracion.upsert({
      where: { centroId: otro.id },
      update: { graciaTipo: "DIAS", graciaValor: 15, diasAvisoCobro: 5 },
      create: { centroId: otro.id, graciaTipo: "DIAS", graciaValor: 15, diasAvisoCobro: 5 },
    });
    await prisma.user.updateMany({
      where: { centroId: otro.id, usuario: "admin" },
      data: { passwordHash: hash },
    });
  }

  /* ── Resumen ─────────────────────────────────────────────── */
  const cuenta = async (sedeId: string) => ({
    pacientes: await prisma.paciente.count({ where: { sedeId } }),
    paquetes: await prisma.paquete.count({ where: { sedeId } }),
    citas: await prisma.cita.count({ where: { sedeId } }),
    pagos: await prisma.pago.count({ where: { sedeId } }),
  });

  console.log("Casos de cobranza sembrados:");
  console.log(resumen.join("\n"));
  console.log("\nSede Principal:", JSON.stringify(await cuenta(principal.id)));
  console.log("Sede SJL      :", JSON.stringify(await cuenta(sjl.id)));
  console.log(
    "\nAcceso a la demo (http://localhost:3100/login)\n" +
      `  Empresa 'arcoiris' · admin / ${CLAVE_DEMO}          (administrador: ve todo)\n` +
      `  Empresa 'arcoiris' · coordinadora / ${CLAVE_DEMO}   (2 sedes, sin configuración)\n` +
      `  Empresa 'arcoiris' · recepcion / ${CLAVE_DEMO}      (solo agenda y sesiones)\n` +
      `  Empresa 'demo'     · admin / ${CLAVE_DEMO}          (otro centro: datos aislados)\n` +
      "  Empresa 'plataforma' · superadmin / admin123      (alta de centros)",
  );
}

/* ── Pago con correlativo por sede, como lo hace la app ───── */

const correlativos = new Map<string, number>();

function prefijoSede(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return (limpio || "SED").slice(0, 3).padEnd(3, "X");
}

async function crearPago(p: {
  sedeId: string;
  sedeNombre: string;
  pacienteId: string;
  paqueteId: string | null;
  concepto: "MATRICULA" | "MATERIALES" | "MENSUALIDAD" | "PAQUETE_SESIONES" | "EVALUACION" | "OTRO";
  monto: number;
  saldo: number;
  metodoPago: "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA" | "TARJETA";
  fecha: Date;
  descripcion?: string;
}) {
  const prefijo = prefijoSede(p.sedeNombre);
  const clave = `${p.sedeId}|${prefijo}`;
  const siguiente = (correlativos.get(clave) ?? 0) + 1;
  correlativos.set(clave, siguiente);

  await prisma.pago.create({
    data: {
      sedeId: p.sedeId,
      pacienteId: p.pacienteId,
      paqueteId: p.paqueteId,
      numeroRecibo: `${prefijo}-${String(siguiente).padStart(6, "0")}`,
      concepto: p.concepto,
      descripcion: p.descripcion,
      monto: p.monto,
      saldo: p.saldo,
      metodoPago: p.metodoPago,
      referencia:
        p.metodoPago === "TRANSFERENCIA" ? `Op. ${100000 + siguiente} — BCP` : null,
      fechaPago: mediodia(p.fecha),
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
