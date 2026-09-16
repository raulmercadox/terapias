// Siembra de fichas clínicas para las demos: las plantillas de cada centro y
// algunas historias, evaluaciones e informes ya llenos.
//
// Incluye un segundo centro, de TERAPIA FÍSICA, cuyo único propósito es poder
// mostrar en una demo que el mismo sistema sirve a los dos rubros: sus fichas
// hablan de dolor, rangos articulares y marcha, no de lenguaje ni conducta.

import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PSICOLOGICA } from "../src/lib/fichas/base/psicologica";
import { FISICA } from "../src/lib/fichas/base/fisica";
import { TIPOS_FICHA } from "../src/lib/fichas/tipos";

/** Valor de un campo tal como lo guarda la ficha (ver src/lib/fichas/tipos). */
const txt = (v: string) => ({ t: "texto", v });
const si = () => ({ t: "casilla", v: true });
const ops = (...v: string[]) => ({ t: "opciones", v });
const tabla = (...filas: Record<string, string>[]) => ({ t: "tabla", filas });
const lista = (items: Record<string, { valor?: string; obs?: string }>) => ({
  t: "checklist",
  items,
});

/** Deja las tres plantillas de un centro en su base, sin personalizar. */
async function plantillasDe(
  prisma: PrismaClient,
  centroId: string,
  base: "psicologica" | "fisica",
) {
  const plantillas = base === "psicologica" ? PSICOLOGICA : FISICA;
  for (const tipo of TIPOS_FICHA) {
    await prisma.plantillaFicha.upsert({
      where: { centroId_tipo: { centroId, tipo } },
      update: { base, version: 1, secciones: plantillas[tipo] as object },
      create: { centroId, tipo, base, version: 1, secciones: plantillas[tipo] as object },
    });
  }
}

export async function sembrarFichas(prisma: PrismaClient): Promise<string[]> {
  const salida: string[] = [];

  /* ══ Centro psicológico (Arcoíris) ══════════════════════ */

  const arcoiris = await prisma.centro.findUnique({ where: { codigo: "arcoiris" } });
  if (!arcoiris) return ["  (sin centro arcoiris: corre primero el seed principal)"];
  await plantillasDe(prisma, arcoiris.id, "psicologica");

  const pacientes = await prisma.paciente.findMany({
    where: { sede: { centroId: arcoiris.id } },
    orderBy: { nombres: "asc" },
    take: 3,
  });

  for (const p of pacientes) {
    await prisma.historiaClinica.deleteMany({ where: { pacienteId: p.id } });
    await prisma.evaluacion.deleteMany({ where: { pacienteId: p.id } });
    await prisma.informeAvance.deleteMany({ where: { pacienteId: p.id } });
  }

  const [uno, dos] = pacientes;
  if (uno) {
    await prisma.historiaClinica.create({
      data: {
        sedeId: uno.sedeId,
        pacienteId: uno.id,
        fecha: new Date(),
        valores: {
          lugarNacimiento: txt("Lima"),
          padreApoderado: txt("Rosa Ríos Palomino"),
          familiares: tabla(
            { parentesco: "Madre", nombres: "Rosa Ríos", edad: "34", ocupacion: "Docente", relacion: "Muy cercana" },
            { parentesco: "Padre", nombres: "Carlos Quispe", edad: "37", ocupacion: "Técnico", relacion: "Cercana" },
          ),
          historiaPrePostnatal: txt("Embarazo controlado, parto a término sin complicaciones."),
          presentacionDificultad: txt(
            "La madre notó a los 2 años que no unía palabras. Lo detectó la maestra del nido.",
          ),
          signosSintomas: txt("Vocabulario reducido, frustración al no hacerse entender."),
          tempranaCentro: txt("Nido Los Girasoles"),
          tempranaAdaptacion: txt("Adaptación lenta las primeras semanas."),
          evolucionMejoria: txt("Mejora sostenida desde que inició terapia de lenguaje."),
          alimentacion: txt("Autónomo, selectivo con las texturas."),
          controlEsfinteres: txt("Logrado a los 3 años."),
          sueno: txt("Duerme toda la noche."),
          autonomiaPersonal: txt("Se viste con ayuda parcial."),
          reaccionPadres: ops("PREOCUPACION", "ACEPTACION"),
          reaccionDetalle: txt("Los padres buscan activamente apoyo profesional."),
          observacionesEntrevista: txt("Familia colaboradora; asisten ambos a la entrevista."),
        },
      },
    });
    salida.push(`  historia clínica de ${uno.nombres} ${uno.apellidoPaterno}`);

    await prisma.evaluacion.create({
      data: {
        sedeId: uno.sedeId,
        pacienteId: uno.id,
        fecha: new Date(),
        plantillaVersion: 1,
        estructura: PSICOLOGICA.EVALUACION as object,
        programaRecomendado: "TERAPIAS",
        recomendaciones: "Terapia de lenguaje individual, 3 veces por semana.",
        valores: {
          lugarNacimiento: txt("Lima"),
          numeroHermanos: txt("1"),
          nivelAcademico: txt("Inicial 4 años"),
          centroEducativo: txt("Nido Los Girasoles"),
          convive: ops("MADRE", "PADRE", "HERMANOS"),
          relacionDetalle: txt("Buena relación con ambos padres."),
          diagnostico: txt("Retraso simple del lenguaje"),
          dificultadesPresenta: txt("Dificultad para estructurar frases de más de tres palabras."),
          modalidadLenguaje: ops("VERBAL"),
          chk_mirada: lista({
            cond_contacto_visual: { valor: "L", obs: "sostiene la mirada" },
            cond_respuesta_nombre: { valor: "L" },
            cond_respuesta_estimulo: { valor: "P" },
            cond_mirada_sostenida: { valor: "P" },
          }),
          chk_instrucciones: lista({
            cond_saluda_despide: { valor: "L" },
            cond_dame_toma: { valor: "L" },
            cond_guarda_recoge: { valor: "P" },
          }),
          chk_verbal: lista({
            leng_onomatopeyicos: { valor: "SI" },
            leng_ecolalia: { valor: "NO" },
            leng_contacto_visual: { valor: "SI" },
            leng_comprende_social: { valor: "NO" },
          }),
          chk_cognitiva: lista({
            cog_colores: { valor: "SI" },
            cog_formas: { valor: "SI" },
            cog_numeros: { valor: "NO" },
          }),
          observacionGeneral: txt("Niño colaborador, tolera bien la sesión de evaluación."),
        },
      },
    });
    salida.push(`  ficha de evaluación de ${uno.nombres} ${uno.apellidoPaterno}`);

    // Dos informes para que la analítica de progreso tenga una serie que mostrar.
    const seccionesInforme = (valores: Record<string, string>) =>
      PSICOLOGICA.INFORME.secciones.map((s) => ({
        id: s.id,
        titulo: s.titulo,
        items: s.grupos
          .flatMap((g) => g.campos)
          .flatMap((c) => (c.tipo === "checklist" ? c.items : []))
          .map((i) => ({ id: i.id, label: i.label, valor: valores[i.id] ?? null })),
      }));

    const hace60 = new Date(Date.now() - 86_400_000 * 60);
    const hace5 = new Date(Date.now() - 86_400_000 * 5);
    await prisma.informeAvance.create({
      data: {
        sedeId: uno.sedeId,
        pacienteId: uno.id,
        fecha: hace60,
        recomendaciones: "Reforzar vocabulario en casa con imágenes.",
        secciones: seccionesInforme({
          len_comprensivo: "EP", len_articulado: "EI", len_narrativo: "EI", len_tema: "EI",
          ped_colores: "EP", ped_figuras: "EI", ped_partes_cuerpo: "EP",
          aut_lavado_manos: "EP", aut_juegos_reglas: "EI",
          soc_saluda_despide: "EP", soc_interactua: "EI",
        }),
      },
    });
    await prisma.informeAvance.create({
      data: {
        sedeId: uno.sedeId,
        pacienteId: uno.id,
        fecha: hace5,
        recomendaciones: "Continuar con praxias y ampliar frases a cuatro palabras.",
        secciones: seccionesInforme({
          len_comprensivo: "LE", len_articulado: "EP", len_narrativo: "EP", len_tema: "EP",
          ped_colores: "LE", ped_figuras: "EP", ped_partes_cuerpo: "LE",
          aut_lavado_manos: "LE", aut_juegos_reglas: "EP",
          soc_saluda_despide: "LE", soc_interactua: "EP",
        }),
      },
    });
    salida.push(`  2 informes de avance de ${uno.nombres} (con serie de progreso)`);
  }

  if (dos) {
    await prisma.historiaClinica.create({
      data: {
        sedeId: dos.sedeId,
        pacienteId: dos.id,
        fecha: new Date(),
        valores: {
          lugarNacimiento: txt("Callao"),
          signosSintomas: txt("Dificultad para mantenerse en la actividad."),
          alimentacion: txt("Come solo."),
          sueno: txt("Sueño interrumpido."),
          reaccionPadres: ops("PREOCUPACION"),
        },
      },
    });
    salida.push(`  historia clínica de ${dos.nombres} ${dos.apellidoPaterno}`);
  }

  /* ══ Centro físico (FisioVida) ══════════════════════════ */

  // Se actualiza en vez de borrar y recrear: el centro cuelga de muchas tablas
  // y Sede no tiene borrado en cascada, así que eliminarlo viola las claves
  // foráneas en cuanto tiene datos. Se limpian solo sus datos operativos.
  const hash = await bcrypt.hash("demo123", 10);
  const marca = {
    nombre: "Centro FisioVida",
    subtitulo: "Rehabilitación y terapia física",
  };
  const fisio = await prisma.centro.upsert({
    where: { codigo: "fisiovida" },
    update: { ...marca, activo: true },
    create: { codigo: "fisiovida", ...marca },
  });

  const sedeDatos = {
    direccion: "Av. Javier Prado 2150, San Isidro",
    telefono: "01 555 9080",
    horaApertura: "08:00",
    horaCierre: "19:00",
  };
  const sedeFisio = await prisma.sede.upsert({
    where: { centroId_nombre: { centroId: fisio.id, nombre: "Principal" } },
    update: sedeDatos,
    create: { centroId: fisio.id, nombre: "Principal", ...sedeDatos },
  });

  await prisma.user.upsert({
    where: { centroId_usuario: { centroId: fisio.id, usuario: "admin" } },
    update: { passwordHash: hash, nombre: "Daniel Espinoza", rol: "ADMINISTRADOR", activo: true },
    create: {
      centroId: fisio.id,
      nombre: "Daniel Espinoza",
      usuario: "admin",
      passwordHash: hash,
      rol: "ADMINISTRADOR",
    },
  });

  await prisma.configuracion.upsert({
    where: { centroId: fisio.id },
    update: { graciaTipo: "DIAS", graciaValor: 20, diasAvisoCobro: 5 },
    create: { centroId: fisio.id, graciaTipo: "DIAS", graciaValor: 20, diasAvisoCobro: 5 },
  });

  await plantillasDe(prisma, fisio.id, "fisica");

  // Datos operativos de la sede, en orden de dependencia.
  await prisma.informeAvance.deleteMany({ where: { sedeId: sedeFisio.id } });
  await prisma.evaluacion.deleteMany({ where: { sedeId: sedeFisio.id } });
  await prisma.historiaClinica.deleteMany({ where: { sedeId: sedeFisio.id } });
  await prisma.apoderado.deleteMany({ where: { paciente: { sedeId: sedeFisio.id } } });
  await prisma.paciente.deleteMany({ where: { sedeId: sedeFisio.id } });
  await prisma.terapeuta.deleteMany({ where: { sedeId: sedeFisio.id } });
  await prisma.programaTerapia.deleteMany({ where: { sedeId: sedeFisio.id } });

  await prisma.terapeuta.createMany({
    data: [
      { sedeId: sedeFisio.id, nombres: "Gabriela", apellidos: "Ríos Mendoza", especialidad: "Fisioterapia traumatológica" },
      { sedeId: sedeFisio.id, nombres: "Álvaro", apellidos: "Benavides León", especialidad: "Terapia deportiva" },
    ],
  });
  await prisma.programaTerapia.createMany({
    data: [
      { sedeId: sedeFisio.id, nombre: "Rehabilitación traumatológica", duracionMin: 45 },
      { sedeId: sedeFisio.id, nombre: "Terapia de columna", duracionMin: 45 },
    ],
  });

  const ricardo = await prisma.paciente.create({
    data: {
      sedeId: sedeFisio.id,
      nombres: "Ricardo",
      apellidoPaterno: "Salas",
      apellidoMaterno: "Ynga",
      dni: "40123456",
      fechaNacimiento: new Date(1979, 4, 22),
      sexo: "M",
      telefono: "987654321",
      distrito: "San Isidro",
      diagnostico: "Lumbalgia mecánica",
      estado: "ACTIVO",
    },
  });
  await prisma.paciente.create({
    data: {
      sedeId: sedeFisio.id,
      nombres: "Elena",
      apellidoPaterno: "Cárdenas",
      apellidoMaterno: "Vilca",
      dni: "41987654",
      fechaNacimiento: new Date(1986, 10, 3),
      sexo: "F",
      telefono: "986112233",
      distrito: "Lince",
      diagnostico: "Síndrome de manguito rotador",
      estado: "ACTIVO",
    },
  });

  await prisma.historiaClinica.create({
    data: {
      sedeId: sedeFisio.id,
      pacienteId: ricardo.id,
      fecha: new Date(),
      valores: {
        ocupacion: txt("Contador"),
        derivadoPor: txt("Dr. Peña — Traumatología"),
        diagnosticoMedico: txt("Lumbalgia mecánica L4-L5"),
        lateralidad: txt("Diestro"),
        motivoConsulta: txt("Dolor lumbar que irradia a la pierna derecha al estar sentado."),
        inicioSintomas: txt("Hace 4 meses"),
        mecanismoLesion: txt("Progresivo, tras mudanza cargando peso."),
        localizacionDolor: txt("Lumbar bajo con irradiación a cara posterior del muslo"),
        tipoDolor: ops("PUNZANTE", "ELECTRICO"),
        factoresAgravantes: txt("Permanecer sentado más de 30 minutos"),
        factoresAlivio: txt("Caminar y aplicar calor local"),
        dolorNocturno: si(),
        antecedentesPatologicos: txt("Sin antecedentes relevantes."),
        examenesImagen: txt("RM: protrusión discal L4-L5."),
        actividadFisica: txt("Sedentario; caminatas los fines de semana."),
        limitacionesAvd: txt("Dificultad para agacharse y atarse los zapatos."),
      },
    },
  });
  await prisma.evaluacion.create({
    data: {
      sedeId: sedeFisio.id,
      pacienteId: ricardo.id,
      fecha: new Date(),
      plantillaVersion: 1,
      estructura: FISICA.EVALUACION as object,
      recomendaciones: "Iniciar programa de estabilización lumbar y reeducación postural.",
      valores: {
        posturaGeneral: txt("Hiperlordosis lumbar, anteversión pélvica."),
        trofismo: txt("Conservado."),
        chk_eva: lista({
          eva_reposo: { valor: "3" },
          eva_movimiento: { valor: "7", obs: "al flexionar el tronco" },
          eva_nocturno: { valor: "5" },
          eva_palpacion: { valor: "6" },
        }),
        chk_rango_inferior: lista({
          rom_cadera_flex: { valor: "LIMITADO", obs: "por dolor" },
          rom_rodilla: { valor: "COMPLETO" },
          rom_tobillo: { valor: "COMPLETO" },
        }),
        chk_rango_columna: lista({
          rom_lumbar: { valor: "LIMITADO", obs: "flexión 40°" },
          rom_dorsal: { valor: "COMPLETO" },
        }),
        chk_fuerza: lista({
          fza_core: { valor: "3", obs: "débil" },
          fza_cuadriceps: { valor: "4" },
          fza_isquiotibiales: { valor: "4" },
        }),
        chk_funcional: lista({
          fun_sentarse: { valor: "SI" },
          fun_agacharse: { valor: "NO", obs: "dolor al intentarlo" },
          fun_escaleras: { valor: "SI" },
        }),
        patronMarcha: txt("Marcha antiálgica leve, disminución del braceo derecho."),
        equilibrio: txt("Conservado."),
        objetivosCorto: txt("Reducir el dolor a EVA 3 en movimiento."),
        objetivosLargo: txt("Retomar la jornada laboral sin dolor."),
        planTratamiento: txt("Terapia manual, ejercicio terapéutico y educación postural."),
        frecuenciaSugerida: txt("3 veces por semana durante 6 semanas"),
      },
    },
  });
  await prisma.informeAvance.create({
    data: {
      sedeId: sedeFisio.id,
      pacienteId: ricardo.id,
      fecha: new Date(),
      recomendaciones: "Mantener el programa domiciliario; reevaluar en 3 semanas.",
      secciones: FISICA.INFORME.secciones.map((s) => ({
        id: s.id,
        titulo: s.titulo,
        items: s.grupos
          .flatMap((g) => g.campos)
          .flatMap((c) => (c.tipo === "checklist" ? c.items : []))
          .map((i) => ({
            id: i.id,
            label: i.label,
            valor: { inf_dolor_reposo: "LE", inf_dolor_actividad: "EP", inf_rom_activo: "EP", inf_fuerza_segmento: "EP", inf_marcha: "LE", inf_avd: "EP", inf_asistencia: "LE" }[i.id] ?? null,
          })),
      })),
    },
  });
  salida.push("  Centro FisioVida: 2 pacientes, historia, evaluación e informe de terapia física");

  return salida;
}
