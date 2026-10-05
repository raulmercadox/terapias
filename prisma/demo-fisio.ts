// Centro de demostración de TERAPIA FÍSICA (FisioVida): el mismo sistema que
// Arcoíris, pero con pacientes adultos, programas de rehabilitación y fichas de
// dolor, rangos articulares y marcha. Se siembra completo —dos sedes, agenda,
// paquetes, cobranza, seguimiento y fichas— para poder recorrer todas las
// pantallas con datos en una demo a un centro de fisioterapia.
//
// Lo llama prisma/demo.ts. Es idempotente: borra los datos operativos del
// centro y los vuelve a crear con fechas relativas a HOY.
//
// Cobranza del centro: 20 días de gracia desde la primera sesión y aviso 5
// días antes. Así, con saldo, un paquete que empezó hace 20 días o más sale
// "vencido" y uno que empezó hace 15 a 19 días sale "por vencer".

import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { FISICA } from "../src/lib/fichas/base/fisica";
import { PALETA, type Punto } from "../src/lib/fichas/mapa";
import { lista, ops, plantillasDe, si, txt } from "./demo-fichas";
import {
  claveFecha,
  creadorDePagos,
  dia,
  diasEntre,
  generarSesiones,
  hoy,
  mediodia,
  sumarMinutos,
  telefono,
  type Franja,
  type MetodoDemo,
  type PagoDemo,
  lineaUnica,
} from "./demo-util";

const GRACIA_DIAS = 20;
const AVISO_DIAS = 5;

/** Misma regla que src/app/(app)/pagos/cobranza.ts con gracia por DÍAS. */
function estadoCobroEsperado(inicio: Date, saldo: number): "vencido" | "por-vencer" | null {
  if (!(saldo > 0)) return null;
  const limite = diasEntre(hoy(), inicio) + GRACIA_DIAS - 1; // días desde hoy
  if (limite < 0) return "vencido";
  if (limite <= AVISO_DIAS) return "por-vencer";
  return null;
}

const L_X_V = (hora: string): Franja[] => [
  { dia: 1, hora },
  { dia: 3, hora },
  { dia: 5, hora },
];
const M_J = (hora: string): Franja[] => [
  { dia: 2, hora },
  { dia: 4, hora },
];

/** Qué se trabajó en la sesión, según el programa. */
const TERAPIA_REALIZADA: Record<string, string> = {
  "Rehabilitación traumatológica":
    "Terapia manual, movilizaciones articulares y fortalecimiento progresivo.",
  "Terapia de columna": "Liberación miofascial, estabilización lumbopélvica y educación postural.",
  "Fisioterapia deportiva": "Ejercicio excéntrico, propiocepción y vendaje neuromuscular.",
  "Rehabilitación neurológica": "Facilitación neuromuscular, control de tronco y reeducación de la marcha.",
  "Pilates terapéutico": "Pilates en reformer: control del core y movilidad de columna.",
};

/* ── Dibujos sobre la silueta de fábrica (public/fichas/cuerpo.svg) ──
 * Coordenadas normalizadas sobre la imagen de 440×530: el frente ocupa la mitad
 * izquierda (la derecha del paciente queda a la izquierda) y la espalda la
 * mitad derecha (la derecha del paciente queda a la derecha). */
const ROJO = PALETA[0];
const AZUL = PALETA[1];

/** Sombreado en zigzag dentro de un rectángulo, como se marca con lápiz. */
function sombreado(x0: number, x1: number, y0: number, y1: number, pasadas: number): Punto[] {
  const out: Punto[] = [];
  for (let i = 0; i <= pasadas; i++) {
    const y = y0 + ((y1 - y0) * i) / pasadas;
    out.push(i % 2 === 0 ? [x0, y] : [x1, y]);
  }
  return out;
}

/** Círculo alrededor de un punto (rx, ry por la proporción de la imagen). */
function circulo(cx: number, cy: number, rx: number, ry = rx * (440 / 530)): Punto[] {
  return Array.from({ length: 25 }, (_, i) => {
    const a = (i / 24) * 2 * Math.PI;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Punto;
  });
}

const mapa = (...trazos: { c: string; p: Punto[] }[]) => ({ t: "mapa", imagen: "base:cuerpo", trazos });

/** Ricardo: lumbar bajo con irradiación a la cara posterior del muslo derecho. */
const DOLOR_RICARDO = mapa(
  { c: ROJO, p: sombreado(0.71, 0.79, 0.41, 0.47, 6) },
  { c: ROJO, p: sombreado(0.765, 0.795, 0.49, 0.68, 9) },
  { c: AZUL, p: sombreado(0.77, 0.795, 0.73, 0.82, 5) },
);
/** Elena: hombro derecho, cara anterolateral. */
const DOLOR_ELENA = mapa({ c: ROJO, p: sombreado(0.13, 0.19, 0.19, 0.25, 5) }, {
  c: ROJO,
  p: circulo(0.16, 0.22, 0.055),
});
/** Lucía: rodilla derecha operada. */
const DOLOR_LUCIA = mapa({ c: ROJO, p: circulo(0.2, 0.715, 0.035) });

/** Desde hoy + n días, el primer día que no sea domingo. */
function diaHabil(n: number): Date {
  const d = dia(n);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

export async function sembrarFisioVida(prisma: PrismaClient, clave: string): Promise<string[]> {
  // Los pagos se juntan y se registran al final en orden de fecha, para que
  // el correlativo de los recibos avance con el calendario como en la app.
  const registrarPago = creadorDePagos(prisma);
  const pagos: PagoDemo[] = [];
  const crearPago = async (p: PagoDemo) => {
    pagos.push(p);
  };
  const salida: string[] = [];

  /* ── Centro y sedes ──────────────────────────────────────── */

  // Se actualiza en vez de borrar y recrear: el centro cuelga de muchas tablas
  // y Sede no tiene borrado en cascada. Se limpian solo sus datos operativos.
  const marca = { nombre: "Centro FisioVida", subtitulo: "Rehabilitación y terapia física" };
  const fisio = await prisma.centro.upsert({
    where: { codigo: "fisiovida" },
    update: { ...marca, activo: true },
    create: { codigo: "fisiovida", ...marca },
  });

  // Jornada amplia con refrigerio: la agenda muestra bloques libres y ocupados.
  const horario = {
    horaApertura: "08:00",
    horaCierre: "19:00",
    refrigerioInicio: "13:00",
    refrigerioFin: "14:00",
    diasLaborales: [1, 2, 3, 4, 5, 6],
    intervaloCalendario: 15,
    intervalosCalendario: [15, 30, 45, 60],
  };
  const sedes = [
    { nombre: "Principal", direccion: "Av. Javier Prado 2150, San Isidro", telefono: "01 555 9080" },
    { nombre: "Surco", direccion: "Av. Primavera 1040, Santiago de Surco", telefono: "01 555 6070" },
  ];
  const [principal, surco] = await Promise.all(
    sedes.map((s) =>
      prisma.sede.upsert({
        where: { centroId_nombre: { centroId: fisio.id, nombre: s.nombre } },
        update: { ...s, ...horario, activo: true },
        create: { centroId: fisio.id, ...s, ...horario },
      }),
    ),
  );

  /* ── Limpieza de los datos operativos ────────────────────── */
  const sedeIds = [principal.id, surco.id];
  const enSedes = { sedeId: { in: sedeIds } };
  await prisma.observacionSesion.deleteMany({ where: { cita: enSedes } });
  await prisma.pago.deleteMany({ where: enSedes });
  await prisma.cita.deleteMany({ where: enSedes });
  await prisma.paquete.deleteMany({ where: enSedes });
  await prisma.interaccion.deleteMany({ where: enSedes });
  await prisma.evaluacion.deleteMany({ where: enSedes });
  await prisma.historiaClinica.deleteMany({ where: enSedes });
  await prisma.informeAvance.deleteMany({ where: enSedes });
  await prisma.apoderado.deleteMany({ where: { paciente: enSedes } });
  await prisma.paciente.deleteMany({ where: enSedes });
  await prisma.terapeuta.deleteMany({ where: enSedes }); // vacaciones y especialidades en cascada
  await prisma.terapia.deleteMany({ where: enSedes });
  await prisma.feriado.deleteMany({ where: enSedes });
  await prisma.especialidad.deleteMany({ where: { centroId: fisio.id } });

  /* ── Cobranza, plantillas de fichas y usuarios ───────────── */
  await prisma.configuracion.upsert({
    where: { centroId: fisio.id },
    update: { graciaTipo: "DIAS", graciaValor: GRACIA_DIAS, diasAvisoCobro: AVISO_DIAS },
    create: {
      centroId: fisio.id,
      graciaTipo: "DIAS",
      graciaValor: GRACIA_DIAS,
      diasAvisoCobro: AVISO_DIAS,
    },
  });
  await plantillasDe(prisma, fisio.id, "fisica");

  const hash = await bcrypt.hash(clave, 10);
  const usuarios = [
    { usuario: "admin", nombre: "Daniel Espinoza", rol: "ADMINISTRADOR" as const },
    { usuario: "coordinadora", nombre: "Mónica Herrera", rol: "COORDINADOR" as const },
    { usuario: "recepcion", nombre: "Recepción San Isidro", rol: "USUARIO" as const },
  ];
  const [, coord, recepcion] = await Promise.all(
    usuarios.map((u) =>
      prisma.user.upsert({
        where: { centroId_usuario: { centroId: fisio.id, usuario: u.usuario } },
        update: { ...u, passwordHash: hash, activo: true },
        create: { centroId: fisio.id, ...u, passwordHash: hash },
      }),
    ),
  );
  // Coordinadora: ambas sedes. Recepción: solo la principal.
  await prisma.userSede.deleteMany({ where: { userId: { in: [coord.id, recepcion.id] } } });
  await prisma.userSede.createMany({
    data: [
      { userId: coord.id, sedeId: principal.id },
      { userId: coord.id, sedeId: surco.id },
      { userId: recepcion.id, sedeId: principal.id },
    ],
  });

  /* ── Especialidades y terapeutas ─────────────────────────── */
  const esp: Record<string, string> = {};
  for (const [nombre, activo] of [
    ["Fisioterapia traumatológica", true],
    ["Terapia deportiva", true],
    ["Rehabilitación neurológica", true],
    ["Terapia manual", true],
    ["Pilates clínico", true],
    ["Fisioterapia geriátrica", true],
    ["Fisioterapia respiratoria", false],
  ] as const) {
    const e = await prisma.especialidad.create({ data: { centroId: fisio.id, nombre, activo } });
    esp[nombre] = e.id;
  }
  const especialidades = (...nombres: string[]) => ({
    especialidades: { create: nombres.map((n) => ({ especialidadId: esp[n] })) },
  });

  /* ── Terapias (especialidad, duración; Pilates es grupal) ── */
  const programas: Record<string, { id: string; duracionMin: number }> = {};
  for (const sede of [principal, surco]) {
    for (const p of [
      { nombre: "Rehabilitación traumatológica", especialidad: "Fisioterapia traumatológica", duracionMin: 45, maxParticipantes: 1 },
      { nombre: "Terapia de columna", especialidad: "Terapia manual", duracionMin: 45, maxParticipantes: 1 },
      { nombre: "Fisioterapia deportiva", especialidad: "Terapia deportiva", duracionMin: 60, maxParticipantes: 1 },
      { nombre: "Rehabilitación neurológica", especialidad: "Rehabilitación neurológica", duracionMin: 60, maxParticipantes: 1 },
      { nombre: "Pilates terapéutico", especialidad: "Pilates clínico", duracionMin: 60, maxParticipantes: 4 },
    ]) {
      const creado = await prisma.terapia.create({
        data: {
          sedeId: sede.id,
          nombre: p.nombre,
          especialidadId: esp[p.especialidad],
          duracionMin: p.duracionMin,
          modalidad: p.maxParticipantes > 1 ? "GRUPAL" : "INDIVIDUAL",
          maxParticipantes: p.maxParticipantes,
        },
      });
      programas[`${sede.id}|${p.nombre}`] = { id: creado.id, duracionMin: p.duracionMin };
    }
  }
  // Una terapia desactivada, para mostrar el estado en Configuración.
  await prisma.terapia.create({
    data: {
      sedeId: principal.id,
      nombre: "Drenaje linfático",
      especialidadId: esp["Terapia manual"],
      duracionMin: 45,
      activo: false,
    },
  });

  const gabriela = await prisma.terapeuta.create({
    data: {
      sedeId: principal.id, nombres: "Gabriela", apellidos: "Ríos Mendoza", telefono: telefono(100),
      ...especialidades("Fisioterapia traumatológica", "Terapia manual"),
    },
  });
  // Refrigerio propio, distinto al de la sede.
  const alvaro = await prisma.terapeuta.create({
    data: {
      sedeId: principal.id, nombres: "Álvaro", apellidos: "Benavides León", telefono: telefono(101),
      refrigerioInicio: "12:30", refrigerioFin: "13:30",
      ...especialidades("Terapia deportiva"),
    },
  });
  const patricia = await prisma.terapeuta.create({
    data: {
      sedeId: principal.id, nombres: "Patricia", apellidos: "Núñez Rojas", telefono: telefono(102),
      ...especialidades("Rehabilitación neurológica", "Fisioterapia geriátrica"),
    },
  });
  const renzo = await prisma.terapeuta.create({
    data: {
      sedeId: principal.id, nombres: "Renzo", apellidos: "Valdivia Castro", telefono: telefono(103),
      ...especialidades("Pilates clínico", "Terapia manual"),
    },
  });
  const sofia = await prisma.terapeuta.create({
    data: {
      sedeId: surco.id, nombres: "Sofía", apellidos: "Carranza Medina", telefono: telefono(104),
      ...especialidades("Fisioterapia traumatológica"),
    },
  });
  const diego = await prisma.terapeuta.create({
    data: {
      sedeId: surco.id, nombres: "Diego", apellidos: "Paz Olivares", telefono: telefono(105),
      ...especialidades("Terapia deportiva", "Terapia manual"),
    },
  });
  // Un terapeuta inactivo (ya no atiende), con historial de especialidad.
  await prisma.terapeuta.create({
    data: {
      sedeId: principal.id, nombres: "Hernán", apellidos: "Quiroga Paz", activo: false,
      ...especialidades("Fisioterapia traumatológica"),
    },
  });

  /* ── Feriado y vacaciones (la agenda los respeta) ────────── */
  const feriado = dia(9).getDay() === 0 ? dia(10) : dia(9);
  for (const s of [principal, surco]) {
    await prisma.feriado.create({
      data: { sedeId: s.id, fecha: feriado, descripcion: "Aniversario de FisioVida" },
    });
  }
  const vacacionInicio = dia(16);
  const vacacionFin = dia(20);
  await prisma.vacacionTerapeuta.create({
    data: {
      terapeutaId: renzo.id,
      fechaInicio: vacacionInicio,
      fechaFin: vacacionFin,
      descripcion: "Curso de certificación en Pilates clínico",
    },
  });
  const esFeriado = (d: Date) => claveFecha(d) === claveFecha(feriado);
  const enVacaciones = (d: Date) => d >= vacacionInicio && d <= vacacionFin;

  /* ── Pacientes con paquete, sesiones y pagos ─────────────── */

  type Caso = {
    sede: typeof principal;
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    dni: string;
    edad: number;
    sexo: "M" | "F";
    distrito: string;
    diagnostico: string;
    programa: string;
    terapeutaId: string;
    horario: Franja[];
    total: number;
    precio: number;
    inicioHace: number; // días antes de hoy en que empezó el paquete
    /** Pagos del paquete: [monto, días antes de hoy, método]. */
    pagos: [number, number, MetodoDemo][];
    estado?: "ACTIVO" | "COMPLETADO" | "ANULADO";
    nota?: string;
    /** Paciente menor de edad: lleva apoderado. */
    apoderado?: { nombres: string; apellidos: string; vinculo: "MADRE" | "PADRE" | "APODERADO" };
  };

  const casos: Caso[] = [
    // Vencido y por renovar: empezó hace 3 semanas y le queda poco.
    {
      sede: principal, nombres: "Ricardo", apellidoPaterno: "Salas", apellidoMaterno: "Ynga",
      dni: "40123456", edad: 46, sexo: "M", distrito: "San Isidro",
      diagnostico: "Lumbalgia mecánica L4-L5", programa: "Terapia de columna",
      terapeutaId: gabriela.id, horario: L_X_V("08:00"), total: 12, precio: 900, inicioHace: 24,
      pagos: [[300, 24, "YAPE"]],
    },
    // Por vencer, sin ningún pago todavía.
    {
      sede: principal, nombres: "Elena", apellidoPaterno: "Cárdenas", apellidoMaterno: "Vilca",
      dni: "41987654", edad: 39, sexo: "F", distrito: "Lince",
      diagnostico: "Síndrome de manguito rotador (hombro derecho)",
      programa: "Rehabilitación traumatológica", terapeutaId: gabriela.id, horario: M_J("09:00"),
      total: 10, precio: 800, inicioHace: 16, pagos: [],
    },
    // Terminado y pagado: aparece "por renovar" (terminó).
    {
      sede: principal, nombres: "Jorge", apellidoPaterno: "Medina", apellidoMaterno: "Salazar",
      dni: "45678123", edad: 28, sexo: "M", distrito: "Surco",
      diagnostico: "Esguince de tobillo grado II", programa: "Fisioterapia deportiva",
      terapeutaId: alvaro.id, horario: L_X_V("10:00"), total: 12, precio: 1080, inicioHace: 30,
      pagos: [[540, 30, "TARJETA"], [540, 16, "TRANSFERENCIA"]],
    },
    // En curso y al corriente: ni vencido ni por renovar.
    {
      sede: principal, nombres: "Lucía", apellidoPaterno: "Fernández", apellidoMaterno: "Quiroz",
      dni: "46781234", edad: 34, sexo: "F", distrito: "Miraflores",
      diagnostico: "Post operatorio de ligamento cruzado anterior (rodilla derecha)",
      programa: "Fisioterapia deportiva", terapeutaId: alvaro.id, horario: L_X_V("11:00"),
      total: 18, precio: 1530, inicioHace: 10, pagos: [[765, 10, "TRANSFERENCIA"]],
    },
    // COMPLETADO con deuda: sale en Cobranza aunque ya terminó.
    {
      sede: principal, nombres: "Teresa", apellidoPaterno: "Gamarra", apellidoMaterno: "Ortiz",
      dni: "08765432", edad: 72, sexo: "F", distrito: "Jesús María",
      diagnostico: "Secuela de ACV isquémico (hemiparesia izquierda)",
      programa: "Rehabilitación neurológica", terapeutaId: patricia.id, horario: L_X_V("15:00"),
      total: 12, precio: 1200, inicioHace: 40, pagos: [[600, 40, "EFECTIVO"]],
      estado: "COMPLETADO", nota: "Familia pidió pagar el saldo en dos partes.",
      apoderado: { nombres: "Raúl", apellidos: "Gamarra Díaz", vinculo: "APODERADO" },
    },
    // Al día: pagado completo, recién empezó.
    {
      sede: principal, nombres: "Manuel", apellidoPaterno: "Ochoa", apellidoMaterno: "Ríos",
      dni: "07654321", edad: 65, sexo: "M", distrito: "San Borja",
      diagnostico: "Gonartrosis bilateral", programa: "Rehabilitación traumatológica",
      terapeutaId: patricia.id, horario: M_J("16:00"), total: 10, precio: 750, inicioHace: 5,
      pagos: [[750, 5, "EFECTIVO"]],
    },
    // Menor de edad (deportista): con apoderado; por vencer.
    {
      sede: principal, nombres: "Sebastián", apellidoPaterno: "Torres", apellidoMaterno: "Luna",
      dni: "78123456", edad: 15, sexo: "M", distrito: "La Molina",
      diagnostico: "Desgarro de isquiotibiales grado I (fútbol)", programa: "Fisioterapia deportiva",
      terapeutaId: alvaro.id, horario: M_J("17:00"), total: 8, precio: 640, inicioHace: 17,
      pagos: [[320, 17, "YAPE"]],
      apoderado: { nombres: "Claudia", apellidos: "Luna Herrera", vinculo: "MADRE" },
    },
    // Anulado con saldo: NO debe aparecer en Cobranza.
    {
      sede: principal, nombres: "Fernando", apellidoPaterno: "Ruiz", apellidoMaterno: "Tello",
      dni: "42345678", edad: 41, sexo: "M", distrito: "Pueblo Libre",
      diagnostico: "Epicondilitis lateral (codo de tenista)", programa: "Rehabilitación traumatológica",
      terapeutaId: gabriela.id, horario: M_J("11:00"), total: 10, precio: 700, inicioHace: 35,
      pagos: [[100, 34, "EFECTIVO"]], estado: "ANULADO",
      nota: "Derivado a cirugía por el traumatólogo.",
    },
    // Terapia grupal: tres pacientes en la misma franja de Pilates (cupo 4).
    {
      sede: principal, nombres: "Andrea", apellidoPaterno: "Silva", apellidoMaterno: "Paredes",
      dni: "47812345", edad: 31, sexo: "F", distrito: "San Isidro",
      diagnostico: "Dorsalgia postural", programa: "Pilates terapéutico",
      terapeutaId: renzo.id, horario: M_J("18:00"), total: 8, precio: 480, inicioHace: 12,
      pagos: [[480, 12, "PLIN"]],
    },
    {
      sede: principal, nombres: "Carolina", apellidoPaterno: "Méndez", apellidoMaterno: "Rivas",
      dni: "43218765", edad: 45, sexo: "F", distrito: "Magdalena",
      diagnostico: "Hernia discal cervical C5-C6 (manejo conservador)",
      programa: "Pilates terapéutico", terapeutaId: renzo.id, horario: M_J("18:00"),
      total: 8, precio: 480, inicioHace: 15, pagos: [[240, 15, "YAPE"]],
    },
    {
      sede: principal, nombres: "Roberto", apellidoPaterno: "Lazo", apellidoMaterno: "Pinto",
      dni: "09876543", edad: 52, sexo: "M", distrito: "Surquillo",
      diagnostico: "Lumbalgia crónica inespecífica", programa: "Pilates terapéutico",
      terapeutaId: renzo.id, horario: M_J("18:00"), total: 8, precio: 480, inicioHace: 3,
      pagos: [[480, 0, "TARJETA"]],
    },
    // Sede Surco: menos datos, para mostrar el cambio de sede.
    {
      sede: surco, nombres: "Gonzalo", apellidoPaterno: "Arias", apellidoMaterno: "Vera",
      dni: "44556677", edad: 37, sexo: "M", distrito: "Santiago de Surco",
      diagnostico: "Cervicalgia tensional", programa: "Terapia de columna",
      terapeutaId: sofia.id, horario: L_X_V("09:00"), total: 12, precio: 900, inicioHace: 18,
      pagos: [[300, 18, "EFECTIVO"]],
    },
    {
      sede: surco, nombres: "Mariana", apellidoPaterno: "Pacheco", apellidoMaterno: "Lozano",
      dni: "47001122", edad: 29, sexo: "F", distrito: "Barranco",
      diagnostico: "Fascitis plantar", programa: "Fisioterapia deportiva",
      terapeutaId: diego.id, horario: M_J("10:00"), total: 8, precio: 640, inicioHace: 6,
      pagos: [[640, 6, "YAPE"]],
    },
    {
      sede: surco, nombres: "Hugo", apellidoPaterno: "Benítez", apellidoMaterno: "Carrillo",
      dni: "06998877", edad: 58, sexo: "M", distrito: "Santiago de Surco",
      diagnostico: "Capsulitis adhesiva (hombro congelado)", programa: "Rehabilitación traumatológica",
      terapeutaId: sofia.id, horario: L_X_V("10:00"), total: 12, precio: 900, inicioHace: 28,
      pagos: [],
    },
  ];

  const hoyClave = claveFecha(hoy());
  // `tratamiento`: la terapia de su paquete, para sugerirla en su evaluación.
  const pacientes: Record<
    string,
    {
      id: string;
      sedeId: string;
      tratamiento?: { terapiaId: string; sesiones: number; sesionesSemana: number };
    }
  > = {};
  const resumen: string[] = [];

  /** Crea un paquete con sus sesiones y pagos. Devuelve el id del paquete. */
  async function paqueteCon(
    c: Pick<Caso, "sede" | "programa" | "terapeutaId" | "horario" | "total" | "precio" | "pagos" | "estado" | "nota">,
    pacienteId: string,
    inicioHace: number,
  ) {
    const prog = programas[`${c.sede.id}|${c.programa}`];
    const saltar = (d: Date) =>
      esFeriado(d) || (c.terapeutaId === renzo.id && enVacaciones(d));
    const sesiones = generarSesiones(dia(-inicioHace), c.total, c.horario, prog.duracionMin, saltar);
    const fechaInicio = sesiones[0].fecha;
    const fechaFin = sesiones[sesiones.length - 1].fecha;
    const anulado = c.estado === "ANULADO";

    const paquete = await prisma.paquete.create({
      data: {
        sedeId: c.sede.id,
        pacienteId,
        totalSesiones: c.total,
        terapias: lineaUnica({
          terapiaId: prog.id,
          terapeutaId: c.terapeutaId,
          totalSesiones: c.total,
          horario: c.horario,
        }),
        precio: c.precio,
        fechaInicio,
        fechaFin,
        estado: c.estado ?? "ACTIVO",
        observacion: c.nota ?? null,
      },
      include: { terapias: { select: { id: true } } },
    });

    // Sesiones pasadas con asistencia (una falta y una tardanza sueltas).
    await prisma.cita.createMany({
      data: sesiones.map((s, i) => {
        const pasada = claveFecha(s.fecha) < hoyClave;
        const asistencia =
          !pasada || anulado
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
          sedeId: c.sede.id,
          pacienteId,
          terapeutaId: c.terapeutaId,
          terapiaId: prog.id,
          paqueteId: paquete.id,
          paqueteTerapiaId: paquete.terapias[0].id,
          numeroSesion: i + 1,
          fecha: s.fecha,
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          tipo: "SESION" as const,
          estado,
          asistencia,
          terapiaRealizada: asistencia === "ASISTIO" ? TERAPIA_REALIZADA[c.programa] : null,
        };
      }),
    });

    let pagado = 0;
    for (const [monto, hace, metodo] of c.pagos) {
      pagado += monto;
      await crearPago({
        sedeId: c.sede.id,
        sedeNombre: c.sede.nombre,
        pacienteId,
        paqueteId: paquete.id,
        concepto: "PAQUETE_SESIONES",
        monto,
        saldo: Math.max(0, c.precio - pagado),
        metodoPago: metodo,
        fecha: dia(-hace),
        descripcion: `Paquete de ${c.total} sesiones · ${c.programa}`,
      });
    }
    return { paqueteId: paquete.id, fechaInicio, fechaFin, saldo: c.precio - pagado };
  }

  for (const [i, c] of casos.entries()) {
    const nacimiento = new Date();
    nacimiento.setFullYear(nacimiento.getFullYear() - c.edad, (i * 5) % 12, 3 + i);
    nacimiento.setHours(0, 0, 0, 0);
    const paciente = await prisma.paciente.create({
      data: {
        sedeId: c.sede.id,
        nombres: c.nombres,
        apellidoPaterno: c.apellidoPaterno,
        apellidoMaterno: c.apellidoMaterno,
        dni: c.dni,
        fechaNacimiento: nacimiento,
        sexo: c.sexo,
        telefono: telefono(200 + i),
        correo: `${c.nombres.toLowerCase()}.${c.apellidoPaterno.toLowerCase()}@example.com`
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, ""),
        direccion: `Av. Principal ${120 + i * 37}`,
        distrito: c.distrito,
        programa: "TERAPIAS",
        diagnostico: c.diagnostico,
        estado: "ACTIVO",
        apoderados: c.apoderado
          ? {
              create: {
                ...c.apoderado,
                dni: `0${7000000 + i}`,
                telefono: telefono(300 + i),
                principal: true,
              },
            }
          : undefined,
      },
    });
    pacientes[c.nombres] = {
      id: paciente.id,
      sedeId: c.sede.id,
      tratamiento: {
        terapiaId: programas[`${c.sede.id}|${c.programa}`].id,
        sesiones: c.total,
        sesionesSemana: c.horario.length,
      },
    };

    const p = await paqueteCon(c, paciente.id, c.inicioHace);
    const cobro =
      c.estado === "ANULADO"
        ? "(anulado, fuera de cobranza)"
        : (estadoCobroEsperado(p.fechaInicio, p.saldo) ?? "al día");
    resumen.push(
      `  ${c.nombres} ${c.apellidoPaterno} (${c.sede.nombre}): ${c.estado ?? "ACTIVO"} · saldo S/ ${p.saldo} · cobranza: ${cobro} · última sesión ${claveFecha(p.fechaFin)}`,
    );
  }

  /* ── Valeria: paquete renovado (el viejo NO debe avisar) ─── */
  const valeria = await prisma.paciente.create({
    data: {
      sedeId: principal.id,
      nombres: "Valeria",
      apellidoPaterno: "Campos",
      apellidoMaterno: "Soto",
      dni: "48765432",
      fechaNacimiento: new Date(new Date().getFullYear() - 26, 8, 14),
      sexo: "F",
      telefono: telefono(250),
      distrito: "Surco",
      programa: "TERAPIAS",
      diagnostico: "Tendinopatía rotuliana (voleibol)",
      estado: "ACTIVO",
    },
  });
  pacientes.Valeria = { id: valeria.id, sedeId: principal.id };
  for (const [inicioHace, precio, nota, metodo] of [
    [35, 640, "Paquete anterior, ya renovado.", "EFECTIVO"],
    [4, 680, "Renovación.", "YAPE"],
  ] as const) {
    await paqueteCon(
      {
        sede: principal, programa: "Fisioterapia deportiva", terapeutaId: alvaro.id,
        horario: M_J("15:00"), total: 8, precio, pagos: [[precio, inicioHace, metodo]], nota,
      },
      valeria.id,
      inicioHace,
    );
  }
  resumen.push("  Valeria Campos: paquete renovado (solo avisa el nuevo)");

  /* ── Observaciones de sesión (bitácora del seguimiento) ──── */
  const notas: Record<string, string[]> = {
    Ricardo: [
      "Refiere menos dolor al levantarse por la mañana (EVA 5).",
      "Tolera bien los ejercicios de estabilización; se agrega puente glúteo.",
      "Dolor irradiado disminuye; ya no despierta por la noche.",
    ],
    Teresa: [
      "Mejora el control de tronco en sedestación.",
      "Logra 10 metros de marcha con andador y supervisión.",
    ],
    Lucía: ["Flexión de rodilla 110°. Sin derrame articular."],
  };
  for (const [nombre, textos] of Object.entries(notas)) {
    const atendidas = await prisma.cita.findMany({
      where: { pacienteId: pacientes[nombre].id, asistencia: "ASISTIO" },
      orderBy: { fecha: "asc" },
      take: textos.length,
      select: { id: true, fecha: true },
    });
    for (const [k, cita] of atendidas.entries()) {
      const cuando = new Date(cita.fecha);
      cuando.setHours(19, 0, 0, 0);
      await prisma.observacionSesion.create({
        data: {
          citaId: cita.id,
          texto: textos[k],
          autor: nombre === "Teresa" ? "Patricia Núñez" : nombre === "Lucía" ? "Álvaro Benavides" : "Gabriela Ríos",
          createdAt: cuando,
        },
      });
    }
  }

  /* ── Interesados: bandeja de seguimiento ─────────────────── */
  type Interesado = {
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    nota: string;
    entrada: { canal: "LLAMADA" | "WHATSAPP" | "VISITA" | "REDES" | "CORREO"; hace: number };
    salida?: { resultado: "CONTACTADO" | "SIN_RESPUESTA"; hace: number; nota: string };
  };
  const interesados: Interesado[] = [
    {
      nombres: "Patricio", apellidoPaterno: "Guerra", apellidoMaterno: "Lima",
      nota: "Dolor de rodilla al correr. Pregunta por evaluación y precios de paquete.",
      entrada: { canal: "WHATSAPP", hace: 1 },
    },
    {
      nombres: "Rosa", apellidoPaterno: "Villanueva", apellidoMaterno: "Cruz",
      nota: "Su madre de 80 años tuvo una caída; consulta por fisioterapia a domicilio.",
      entrada: { canal: "LLAMADA", hace: 3 },
    },
    {
      nombres: "Kevin", apellidoPaterno: "Ramos", apellidoMaterno: "Ugarte",
      nota: "Vio la publicación de Pilates terapéutico. Pide horarios disponibles.",
      entrada: { canal: "REDES", hace: 4 },
      salida: { resultado: "SIN_RESPUESTA", hace: 2, nota: "Se le llamó dos veces, no contesta." },
    },
    {
      nombres: "Silvia", apellidoPaterno: "Montes", apellidoMaterno: "Aguirre",
      nota: "Post operatorio de hombro, derivada por el Dr. Peña.",
      entrada: { canal: "VISITA", hace: 6 },
      // Contactada hoy: aparece en "Contactos de hoy".
      salida: { resultado: "CONTACTADO", hace: 0, nota: "Se agendó evaluación; traerá la orden médica." },
    },
  ];
  for (const [i, it] of interesados.entries()) {
    const p = await prisma.paciente.create({
      data: {
        sedeId: principal.id,
        nombres: it.nombres,
        apellidoPaterno: it.apellidoPaterno,
        apellidoMaterno: it.apellidoMaterno,
        telefono: telefono(400 + i),
        programa: "TERAPIAS",
        estado: "ACTIVO",
        diagnostico: "Por evaluar",
      },
    });
    pacientes[it.nombres] = { id: p.id, sedeId: principal.id };
    const fecha = mediodia(dia(-it.entrada.hace));
    fecha.setHours(10 + i, 15, 0, 0);
    await prisma.interaccion.create({
      data: {
        sedeId: principal.id, pacienteId: p.id, direccion: "ENTRADA",
        canal: it.entrada.canal, fecha, nota: it.nota, autor: "Recepción San Isidro",
      },
    });
    if (it.salida) {
      const f = mediodia(dia(-it.salida.hace));
      f.setHours(16, 30, 0, 0);
      // Si es de hoy, una hora antes de correr el guion (nunca en el futuro).
      if (it.salida.hace === 0) f.setTime(Date.now() - 3_600_000);
      await prisma.interaccion.create({
        data: {
          sedeId: principal.id, pacienteId: p.id, direccion: "SALIDA", canal: "LLAMADA",
          fecha: f, resultado: it.salida.resultado, nota: it.salida.nota, autor: "Mónica Herrera",
        },
      });
    }
  }

  // Recordatorios de saldo a pacientes con pago vencido: salen en su ficha
  // (no en la bandeja, que solo lista a quien buscó al centro).
  for (const nombre of ["Ricardo", "Teresa"]) {
    const p = pacientes[nombre];
    const f = mediodia(dia(-1));
    f.setHours(11, 0, 0, 0);
    await prisma.interaccion.create({
      data: {
        sedeId: p.sedeId, pacienteId: p.id, direccion: "SALIDA", canal: "WHATSAPP", fecha: f,
        resultado: "CONTACTADO", autor: "Mónica Herrera",
        nota: "Recordatorio del saldo pendiente del paquete. Pagará esta semana.",
      },
    });
  }

  /* ── Citas sueltas: evaluaciones y consultas ─────────────── */
  const sueltas = [
    // Hechas: la evaluación inicial de dos pacientes con paquete.
    { cuando: diaHabil(-26), hora: "09:00", tipo: "EVALUACION" as const, terapeuta: gabriela.id, paciente: "Ricardo", hecha: true },
    { cuando: diaHabil(-12), hora: "16:00", tipo: "EVALUACION" as const, terapeuta: alvaro.id, paciente: "Lucía", hecha: true },
    // Próximas: interesados que vienen a evaluarse y consultas de control.
    { cuando: diaHabil(0), hora: "14:00", tipo: "EVALUACION" as const, terapeuta: gabriela.id, paciente: "Silvia", hecha: false },
    { cuando: diaHabil(1), hora: "10:00", tipo: "CONSULTA" as const, terapeuta: alvaro.id, paciente: "Patricio", hecha: false },
    { cuando: diaHabil(3), hora: "10:00", tipo: "CONSULTA" as const, terapeuta: patricia.id, paciente: "Teresa", hecha: false },
    { cuando: diaHabil(4), hora: "14:30", tipo: "EVALUACION" as const, terapeuta: gabriela.id, paciente: "Rosa", hecha: false },
  ];
  for (const s of sueltas) {
    const p = pacientes[s.paciente];
    await prisma.cita.create({
      data: {
        sedeId: p.sedeId,
        pacienteId: p.id,
        terapeutaId: s.terapeuta,
        fecha: s.cuando,
        horaInicio: s.hora,
        horaFin: sumarMinutos(s.hora, s.tipo === "EVALUACION" ? 60 : 30),
        tipo: s.tipo,
        estado: s.hecha ? "ATENDIDA" : "AGENDADA",
        asistencia: s.hecha ? "ASISTIO" : "PENDIENTE",
      },
    });
  }

  /* ── Pagos sueltos (evaluaciones, materiales, Pilates) ────── */
  const sueltosPagos: [string, number, number, MetodoDemo, "EVALUACION" | "MATERIALES" | "MENSUALIDAD" | "OTRO", string][] = [
    ["Ricardo", 120, 26, "EFECTIVO", "EVALUACION", "Evaluación fisioterapéutica inicial"],
    ["Lucía", 120, 12, "YAPE", "EVALUACION", "Evaluación fisioterapéutica inicial"],
    ["Jorge", 45, 20, "PLIN", "MATERIALES", "Vendaje neuromuscular (kinesiotape)"],
    ["Elena", 120, 17, "TARJETA", "EVALUACION", "Evaluación fisioterapéutica inicial"],
    ["Sebastián", 45, 9, "YAPE", "MATERIALES", "Vendaje neuromuscular (kinesiotape)"],
    ["Manuel", 85, 4, "EFECTIVO", "MATERIALES", "Rodillera ortopédica"],
    ["Andrea", 260, 1, "TRANSFERENCIA", "MENSUALIDAD", "Pilates libre: mensualidad"],
    ["Teresa", 150, 1, "EFECTIVO", "OTRO", "Alquiler de andador (1 mes)"],
    ["Mariana", 120, 0, "YAPE", "EVALUACION", "Reevaluación"],
  ];
  for (const [nombre, monto, hace, metodo, concepto, descripcion] of sueltosPagos) {
    const p = pacientes[nombre];
    await crearPago({
      sedeId: p.sedeId,
      sedeNombre: p.sedeId === principal.id ? principal.nombre : surco.nombre,
      pacienteId: p.id,
      paqueteId: null,
      concepto,
      monto,
      saldo: 0,
      metodoPago: metodo,
      fecha: dia(-hace),
      descripcion,
    });
  }

  pagos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  for (const p of pagos) await registrarPago(p);

  /* ── Fichas clínicas ─────────────────────────────────────── */
  const historias: [string, number, Record<string, unknown>][] = [
    ["Ricardo", 26, {
      ocupacion: txt("Contador"),
      derivadoPor: txt("Dr. Peña — Traumatología"),
      diagnosticoMedico: txt("Lumbalgia mecánica L4-L5"),
      lateralidad: txt("Diestro"),
      motivoConsulta: txt("Dolor lumbar que irradia a la pierna derecha al estar sentado."),
      inicioSintomas: txt("Hace 4 meses"),
      mecanismoLesion: txt("Progresivo, tras una mudanza cargando peso."),
      evolucionSintomas: txt("Empeora en jornadas largas frente a la computadora."),
      localizacionDolor: txt("Lumbar bajo con irradiación a la cara posterior del muslo"),
      mapaDolor: DOLOR_RICARDO,
      tipoDolor: ops("PUNZANTE", "ELECTRICO"),
      factoresAgravantes: txt("Permanecer sentado más de 30 minutos"),
      factoresAlivio: txt("Caminar y aplicar calor local"),
      dolorNocturno: si(),
      antecedentesPatologicos: txt("Sin antecedentes relevantes."),
      medicacionActual: txt("Naproxeno 550 mg cuando hay dolor"),
      examenesImagen: txt("RM: protrusión discal L4-L5 sin compromiso radicular."),
      actividadFisica: txt("Sedentario; caminatas los fines de semana."),
      exigenciaLaboral: txt("Trabajo de oficina, 9 horas sentado."),
      limitacionesAvd: txt("Dificultad para agacharse y atarse los zapatos."),
      observacionesEntrevista: txt("Paciente motivado; pide ejercicios para hacer en la oficina."),
    }],
    ["Elena", 17, {
      ocupacion: txt("Profesora de educación física"),
      derivadoPor: txt("Dra. Salinas — Medicina física"),
      diagnosticoMedico: txt("Tendinopatía del supraespinoso, hombro derecho"),
      lateralidad: txt("Diestra"),
      motivoConsulta: txt("Dolor al elevar el brazo por encima de la cabeza."),
      inicioSintomas: txt("Hace 2 meses"),
      mecanismoLesion: txt("Sobreuso: clases de vóley con muchos remates."),
      localizacionDolor: txt("Cara anterolateral del hombro derecho"),
      mapaDolor: DOLOR_ELENA,
      tipoDolor: ops("SORDO", "PUNZANTE"),
      factoresAgravantes: txt("Dormir sobre el lado derecho, colgar ropa"),
      factoresAlivio: txt("Reposo y hielo"),
      dolorNocturno: si(),
      examenesImagen: txt("Ecografía: tendinosis del supraespinoso sin rotura."),
      actividadFisica: txt("Vóley 3 veces por semana"),
      limitacionesAvd: txt("Le cuesta peinarse y alcanzar objetos altos."),
    }],
    ["Lucía", 12, {
      ocupacion: txt("Diseñadora gráfica"),
      derivadoPor: txt("Dr. Paredes — Cirugía artroscópica"),
      diagnosticoMedico: txt("Post operatorio de plastía de LCA (injerto isquiotibial), 3 semanas"),
      lateralidad: txt("Diestra"),
      motivoConsulta: txt("Rehabilitación post quirúrgica y retorno al fútbol amateur."),
      inicioSintomas: txt("Lesión hace 3 meses; cirugía hace 3 semanas"),
      mecanismoLesion: txt("Giro con el pie apoyado jugando fútbol."),
      cirugiasPrevias: txt("Plastía de LCA rodilla derecha."),
      medicacionActual: txt("Paracetamol 1 g si hay dolor"),
      actividadFisica: txt("Fútbol amateur los sábados (suspendido)"),
      limitacionesAvd: txt("Usa muletas para distancias largas; dificultad en escaleras."),
    }],
    ["Teresa", 40, {
      ocupacion: txt("Jubilada (docente)"),
      derivadoPor: txt("Dr. Morales — Neurología"),
      diagnosticoMedico: txt("ACV isquémico de la arteria cerebral media derecha"),
      lateralidad: txt("Diestra"),
      motivoConsulta: txt("Recuperar la marcha y la independencia en las actividades del hogar."),
      inicioSintomas: txt("ACV hace 5 meses"),
      evolucionSintomas: txt("Mejoría parcial tras hospitalización y terapia inicial."),
      antecedentesPatologicos: txt("Hipertensión arterial, diabetes tipo 2."),
      medicacionActual: txt("Losartán, metformina, clopidogrel"),
      tratamientosPrevios: txt("Terapia física en el hospital durante 1 mes."),
      limitacionesAvd: txt("Necesita ayuda para vestirse y para el baño."),
      observacionesEntrevista: txt("Acude con su hijo; buen soporte familiar."),
    }],
  ];
  for (const [nombre, hace, valores] of historias) {
    const p = pacientes[nombre];
    await prisma.historiaClinica.create({
      data: { sedeId: p.sedeId, pacienteId: p.id, fecha: dia(-hace), valores: valores as object },
    });
  }

  const evaluaciones: [string, number, string, Record<string, unknown>][] = [
    ["Ricardo", 26, "Programa de estabilización lumbar y reeducación postural, 3 veces por semana.", {
      posturaGeneral: txt("Hiperlordosis lumbar, anteversión pélvica."),
      trofismo: txt("Conservado."),
      chk_eva: lista({
        eva_reposo: { valor: "3" },
        eva_movimiento: { valor: "7", obs: "al flexionar el tronco" },
        eva_nocturno: { valor: "5" },
        eva_palpacion: { valor: "6" },
      }),
      mapaDolorEval: DOLOR_RICARDO,
      chk_rango_inferior: lista({
        rom_cadera_flex: { valor: "LIMITADO", obs: "por dolor" },
        rom_rodilla: { valor: "COMPLETO" },
        rom_tobillo: { valor: "COMPLETO" },
      }),
      chk_rango_columna: lista({
        rom_lumbar: { valor: "LIMITADO", obs: "flexión 40°" },
        rom_dorsal: { valor: "COMPLETO" },
        rom_cervical: { valor: "COMPLETO" },
      }),
      chk_fuerza: lista({
        fza_core: { valor: "3", obs: "débil" },
        fza_cadera: { valor: "4" },
        fza_cuadriceps: { valor: "4" },
        fza_isquiotibiales: { valor: "4" },
      }),
      chk_funcional: lista({
        fun_sentarse: { valor: "SI" },
        fun_agacharse: { valor: "NO", obs: "dolor al intentarlo" },
        fun_escaleras: { valor: "SI" },
        fun_monopodal: { valor: "SI" },
      }),
      patronMarcha: txt("Marcha antiálgica leve, disminución del braceo derecho."),
      equilibrio: txt("Conservado."),
      objetivosCorto: txt("Reducir el dolor a EVA 3 en movimiento."),
      objetivosLargo: txt("Retomar la jornada laboral completa sin dolor."),
      planTratamiento: txt("Terapia manual, ejercicio terapéutico y educación postural."),
      frecuenciaSugerida: txt("3 veces por semana durante 4 semanas"),
      observacionGeneral: txt("Colaborador; comprende bien las indicaciones."),
    }],
    ["Elena", 17, "Rehabilitación de manguito rotador: 2 veces por semana, 5 semanas.", {
      posturaGeneral: txt("Hombros en antepulsión, cifosis dorsal leve."),
      edema: txt("No presenta."),
      chk_eva: lista({
        eva_reposo: { valor: "2" },
        eva_movimiento: { valor: "6", obs: "arco doloroso 70°–120°" },
        eva_nocturno: { valor: "5" },
      }),
      mapaDolorEval: DOLOR_ELENA,
      chk_rango_superior: lista({
        rom_hombro_flex: { valor: "LIMITADO", obs: "flexión 140°" },
        rom_hombro_abd: { valor: "LIMITADO", obs: "abducción 120°" },
        rom_hombro_rot: { valor: "LIMITADO" },
        rom_codo: { valor: "COMPLETO" },
        rom_muneca: { valor: "COMPLETO" },
      }),
      chk_fuerza: lista({
        fza_hombro: { valor: "3", obs: "dolor en rotación externa" },
        fza_codo: { valor: "5" },
        fza_mano: { valor: "5" },
      }),
      chk_funcional: lista({
        fun_alcanzar: { valor: "NO", obs: "solo con dolor" },
        fun_sentarse: { valor: "SI" },
      }),
      objetivosCorto: txt("Arco de movimiento completo sin dolor."),
      objetivosLargo: txt("Volver a dictar clases de vóley."),
      planTratamiento: txt("Ejercicio isométrico y excéntrico de rotadores, terapia manual, fisioterapia analgésica."),
      frecuenciaSugerida: txt("2 veces por semana"),
    }],
    ["Lucía", 12, "Protocolo de LCA fase 2: fortalecimiento y propiocepción, 3 veces por semana.", {
      posturaGeneral: txt("Descarga de peso hacia el lado izquierdo."),
      edema: txt("Edema leve periarticular en rodilla derecha."),
      trofismo: txt("Hipotrofia de cuádriceps derecho (−2 cm a 10 cm del polo superior de la rótula)."),
      cicatrices: txt("Portales artroscópicos y toma de injerto, en buen estado."),
      usaAyuda: txt("Muletas para distancias largas"),
      chk_eva: lista({
        eva_reposo: { valor: "1" },
        eva_movimiento: { valor: "4" },
      }),
      mapaDolorEval: DOLOR_LUCIA,
      chk_rango_inferior: lista({
        rom_rodilla: { valor: "LIMITADO", obs: "flexión 95°, extensión completa" },
        rom_cadera_flex: { valor: "COMPLETO" },
        rom_tobillo: { valor: "COMPLETO" },
      }),
      chk_fuerza: lista({
        fza_cuadriceps: { valor: "3" },
        fza_isquiotibiales: { valor: "3", obs: "zona dadora del injerto" },
        fza_cadera: { valor: "4" },
        fza_tobillo: { valor: "5" },
      }),
      chk_funcional: lista({
        fun_monopodal: { valor: "NO" },
        fun_escaleras: { valor: "NO", obs: "baja de a un escalón" },
        fun_agacharse: { valor: "NO" },
      }),
      patronMarcha: txt("Marcha con flexión de rodilla disminuida en fase de balanceo."),
      riesgoCaidas: si(),
      objetivosCorto: txt("Flexión de 120° y marcha sin muletas."),
      objetivosLargo: txt("Retorno al deporte a los 6–9 meses de la cirugía."),
      planTratamiento: txt("Fortalecimiento en cadena cerrada, propiocepción, crioterapia."),
      frecuenciaSugerida: txt("3 veces por semana durante 6 semanas"),
    }],
    ["Teresa", 40, "Rehabilitación neurológica 3 veces por semana con enfoque en marcha y transferencias.", {
      posturaGeneral: txt("Inclinación del tronco hacia la izquierda en bipedestación."),
      trofismo: txt("Hipotrofia de miembro superior izquierdo."),
      usaAyuda: txt("Andador de 4 puntas"),
      chk_rango_superior: lista({
        rom_hombro_flex: { valor: "LIMITADO", obs: "lado izquierdo" },
        rom_codo: { valor: "COMPLETO" },
        rom_muneca: { valor: "LIMITADO" },
      }),
      chk_rango_inferior: lista({
        rom_cadera_flex: { valor: "COMPLETO" },
        rom_rodilla: { valor: "COMPLETO" },
        rom_tobillo: { valor: "LIMITADO", obs: "flexión dorsal izquierda" },
      }),
      chk_fuerza: lista({
        fza_hombro: { valor: "2" },
        fza_mano: { valor: "2" },
        fza_cadera: { valor: "3" },
        fza_cuadriceps: { valor: "3" },
        fza_tobillo: { valor: "2" },
      }),
      chk_funcional: lista({
        fun_monopodal: { valor: "NO" },
        fun_tandem: { valor: "NO" },
        fun_sentarse: { valor: "NO", obs: "requiere apoyo de brazos" },
        fun_escaleras: { valor: "NO" },
      }),
      patronMarcha: txt("Marcha hemiparética con circunducción de la pierna izquierda."),
      distanciaMarcha: txt("15 metros con andador"),
      equilibrio: txt("Equilibrio estático aceptable; dinámico disminuido."),
      riesgoCaidas: si(),
      objetivosCorto: txt("Transferencias de la cama a la silla de forma independiente."),
      objetivosLargo: txt("Marcha con bastón dentro de casa."),
      planTratamiento: txt("Facilitación neuromuscular, entrenamiento de marcha, ejercicios de equilibrio."),
      frecuenciaSugerida: txt("3 veces por semana"),
    }],
  ];
  for (const [nombre, hace, recomendaciones, valores] of evaluaciones) {
    const p = pacientes[nombre];
    await prisma.evaluacion.create({
      data: {
        sedeId: p.sedeId,
        pacienteId: p.id,
        evaluadorId:
          nombre === "Teresa" ? patricia.id : nombre === "Lucía" ? alvaro.id : gabriela.id,
        fecha: dia(-hace),
        plantillaVersion: 1,
        estructura: FISICA.EVALUACION as object,
        recomendaciones,
        valores: valores as object,
        // Tratamiento sugerido: la terapia que luego se le agendó.
        plazoSemanas: 4,
        ...(p.tratamiento ? { tratamiento: { create: [p.tratamiento] } } : {}),
      },
    });
  }

  // Informes de avance: varios por paciente para que el progreso tenga serie.
  const seccionesInforme = (valores: Record<string, string>) =>
    FISICA.INFORME.secciones.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      items: s.grupos
        .flatMap((g) => g.campos)
        .flatMap((c) => (c.tipo === "checklist" ? c.items : []))
        .map((i) => ({ id: i.id, label: i.label, valor: valores[i.id] ?? null })),
    }));
  const informes: [string, string, number, string, Record<string, string>][] = [
    ["Ricardo", gabriela.id, 14, "Continuar estabilización; iniciar ejercicios en casa.", {
      inf_dolor_reposo: "EP", inf_dolor_actividad: "EI", inf_dolor_nocturno: "EI", inf_dolor_analgesicos: "EP",
      inf_rom_activo: "EI", inf_rom_pasivo: "EP", inf_flexibilidad: "EI", inf_rigidez: "EP",
      inf_fuerza_segmento: "EI", inf_resistencia: "EI", inf_estabilidad: "EP", inf_control_motor: "EI",
      inf_marcha: "EP", inf_avd: "EI", inf_reintegro: "EI",
      inf_asistencia: "LE", inf_ejercicios_casa: "EP", inf_recomendaciones: "EP",
    }],
    ["Ricardo", gabriela.id, 2, "Mantener el programa domiciliario; reevaluar en 3 semanas.", {
      inf_dolor_reposo: "LE", inf_dolor_actividad: "EP", inf_dolor_nocturno: "LE", inf_dolor_analgesicos: "LE",
      inf_rom_activo: "EP", inf_rom_pasivo: "LE", inf_flexibilidad: "EP", inf_rigidez: "LE",
      inf_fuerza_segmento: "EP", inf_resistencia: "EP", inf_estabilidad: "LE", inf_control_motor: "EP",
      inf_marcha: "LE", inf_avd: "EP", inf_reintegro: "EP",
      inf_asistencia: "LE", inf_ejercicios_casa: "LE", inf_recomendaciones: "EP",
    }],
    ["Teresa", patricia.id, 30, "Reforzar transferencias en casa con ayuda del familiar.", {
      inf_rom_activo: "EI", inf_rom_pasivo: "EP",
      inf_fuerza_segmento: "EI", inf_resistencia: "EI", inf_estabilidad: "EI", inf_control_motor: "EI",
      inf_marcha: "EI", inf_equilibrio: "EI", inf_escaleras: "EI", inf_avd: "EI", inf_ayuda_tecnica: "EI",
      inf_asistencia: "LE", inf_ejercicios_casa: "EP", inf_recomendaciones: "EP",
    }],
    ["Teresa", patricia.id, 18, "Progresar a marcha con bastón en superficies planas.", {
      inf_rom_activo: "EP", inf_rom_pasivo: "LE",
      inf_fuerza_segmento: "EP", inf_resistencia: "EP", inf_estabilidad: "EP", inf_control_motor: "EI",
      inf_marcha: "EP", inf_equilibrio: "EP", inf_escaleras: "EI", inf_avd: "EP", inf_ayuda_tecnica: "EI",
      inf_asistencia: "LE", inf_ejercicios_casa: "LE", inf_recomendaciones: "EP",
    }],
    ["Teresa", patricia.id, 13, "Alta del paquete; se sugiere continuar con un segundo bloque.", {
      inf_rom_activo: "LE", inf_rom_pasivo: "LE",
      inf_fuerza_segmento: "EP", inf_resistencia: "LE", inf_estabilidad: "LE", inf_control_motor: "EP",
      inf_marcha: "LE", inf_equilibrio: "EP", inf_escaleras: "EP", inf_avd: "LE", inf_ayuda_tecnica: "EP",
      inf_asistencia: "LE", inf_ejercicios_casa: "LE", inf_recomendaciones: "LE",
    }],
    ["Lucía", alvaro.id, 1, "Iniciar trote en cinta la próxima fase si mantiene la evolución.", {
      inf_dolor_reposo: "LE", inf_dolor_actividad: "EP",
      inf_rom_activo: "EP", inf_rom_pasivo: "EP", inf_flexibilidad: "EP",
      inf_fuerza_segmento: "EI", inf_estabilidad: "EP", inf_control_motor: "EP",
      inf_marcha: "LE", inf_escaleras: "EP", inf_ayuda_tecnica: "LE", inf_reintegro: "EI",
      inf_asistencia: "LE", inf_ejercicios_casa: "LE", inf_recomendaciones: "LE",
    }],
  ];
  for (const [nombre, evaluadorId, hace, recomendaciones, valores] of informes) {
    const p = pacientes[nombre];
    await prisma.informeAvance.create({
      data: {
        sedeId: p.sedeId,
        pacienteId: p.id,
        evaluadorId,
        fecha: dia(-hace),
        recomendaciones,
        secciones: seccionesInforme(valores),
      },
    });
  }

  salida.push(...resumen);
  salida.push(
    `  ${historias.length} historias clínicas, ${evaluaciones.length} evaluaciones y ${informes.length} informes de avance`,
    `  ${interesados.length} interesados en seguimiento, ${sueltas.length} evaluaciones/consultas sueltas`,
    `  feriado ${claveFecha(feriado)} · vacaciones de Renzo ${claveFecha(vacacionInicio)} a ${claveFecha(vacacionFin)}`,
  );
  return salida;
}
