// Siembra de fichas clínicas para las demos: las plantillas de cada centro y
// algunas historias, evaluaciones e informes ya llenos. El centro de terapia
// física (FisioVida) tiene su propio guion completo en demo-fisio.ts.

import type { PrismaClient } from "@prisma/client";
import { PSICOLOGICA } from "../src/lib/fichas/base/psicologica";
import { FISICA } from "../src/lib/fichas/base/fisica";
import { TIPOS_FICHA } from "../src/lib/fichas/tipos";

/** Valor de un campo tal como lo guarda la ficha (ver src/lib/fichas/tipos). */
export const txt = (v: string) => ({ t: "texto", v });
export const si = () => ({ t: "casilla", v: true });
export const ops = (...v: string[]) => ({ t: "opciones", v });
const tabla = (...filas: Record<string, string>[]) => ({ t: "tabla", filas });
export const lista = (items: Record<string, { valor?: string; obs?: string }>) => ({
  t: "checklist",
  items,
});

/** Deja las tres plantillas de un centro en su base, sin personalizar. */
export async function plantillasDe(
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

  return salida;
}
