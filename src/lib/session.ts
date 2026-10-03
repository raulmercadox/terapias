import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { PermisoTerapeuta, Prisma, Rol, Sede } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tienePermiso } from "@/lib/permisos";

/** Usuario tal como viene en la sesión (el SUPERADMIN no tiene centro). */
export type UsuarioSesion = {
  id: string;
  nombre: string;
  usuario: string;
  rol: Rol;
  centroId: string | null;
  sedeIds: string[];
};

/** Datos del profesional vinculado a un usuario con rol TERAPEUTA. */
export type TerapeutaContexto = {
  terapeutaId: string;
  sedeId: string;
  permisos: PermisoTerapeuta[];
  tieneFirma: boolean;
};

/** Usuario de un centro: el que operan todos los módulos de la app. */
export type SessionUser = UsuarioSesion & {
  centroId: string;
  /**
   * Solo rol TERAPEUTA. null si el usuario quedó sin terapeuta vinculado, o si
   * este o el usuario están inactivos: entonces tampoco tiene sedes.
   */
  terapeuta?: TerapeutaContexto | null;
};

const SEDE_COOKIE = "sede_activa";

/** Devuelve el usuario de la sesión o null. */
export async function getCurrentUser(): Promise<UsuarioSesion | null> {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Contexto del terapeuta, leído de la BD en cada request (no del JWT): así los
 * cambios del administrador —permisos, sede, desactivarlo— aplican al momento,
 * sin que el terapeuta tenga que volver a iniciar sesión.
 */
const cargarTerapeutaContexto = cache(
  async (userId: string, centroId: string): Promise<TerapeutaContexto | null> => {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        activo: true,
        rol: true,
        centroId: true,
        permisos: true,
        terapeuta: {
          select: {
            id: true,
            sedeId: true,
            activo: true,
            firma: true,
            sede: { select: { centroId: true } },
          },
        },
      },
    });
    if (!u || !u.activo || u.rol !== "TERAPEUTA" || u.centroId !== centroId) {
      return null;
    }
    const t = u.terapeuta;
    if (!t || !t.activo || t.sede.centroId !== centroId) return null;
    return {
      terapeutaId: t.id,
      sedeId: t.sedeId,
      permisos: u.permisos,
      tieneFirma: !!t.firma,
    };
  },
);

/**
 * Exige sesión de un usuario de centro; redirige a /login si no hay. El
 * superadmin no opera centros: se le manda a su panel.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol === "SUPERADMIN" || !user.centroId) redirect("/plataforma");
  if (user.rol !== "TERAPEUTA") return user as SessionUser;

  // La sede del terapeuta es la de su ficha, no la que quedó en el JWT.
  const terapeuta = await cargarTerapeutaContexto(user.id, user.centroId);
  return {
    ...user,
    centroId: user.centroId,
    terapeuta,
    sedeIds: terapeuta ? [terapeuta.sedeId] : [],
  };
}

/** Exige sesión de SUPERADMIN. Úsalo en el panel /plataforma y sus acciones. */
export async function requireSuperadmin(): Promise<UsuarioSesion> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol !== "SUPERADMIN") redirect("/panel");
  return user;
}

/** Datos de marca del centro. Memoizado por request. */
export const getCentro = cache(async (centroId: string) =>
  prisma.centro.findUniqueOrThrow({
    where: { id: centroId },
    // Sin logoBase64 a propósito: la imagen se sirve aparte (/api/centro/logo) y
    // logoActualizadoEn basta para saber si hay logo y versionar su URL.
    select: {
      id: true,
      codigo: true,
      nombre: true,
      subtitulo: true,
      activo: true,
      logoActualizadoEn: true,
    },
  }),
);

/** Ids de todas las sedes del centro (activas o no). Memoizado por request. */
const getSedeIdsDelCentro = cache(async (centroId: string) => {
  const sedes = await prisma.sede.findMany({
    where: { centroId },
    select: { id: true },
  });
  return sedes.map((s) => s.id);
});

/** Sedes que el usuario puede ver (admin = todas las de su centro). */
export async function getSedesForUser(user: SessionUser): Promise<Sede[]> {
  if (user.rol === "ADMINISTRADOR") {
    return prisma.sede.findMany({
      where: { centroId: user.centroId, activo: true },
      orderBy: { nombre: "asc" },
    });
  }
  return prisma.sede.findMany({
    where: { id: { in: user.sedeIds }, centroId: user.centroId, activo: true },
    orderBy: { nombre: "asc" },
  });
}

/**
 * ¿El usuario tiene acceso a esta sede? El admin, a cualquiera de su centro;
 * los demás, solo a las que tienen asignadas.
 */
export async function canAccessSede(
  user: SessionUser,
  sedeId: string,
): Promise<boolean> {
  if (user.rol === "ADMINISTRADOR") {
    return (await getSedeIdsDelCentro(user.centroId)).includes(sedeId);
  }
  return user.sedeIds.includes(sedeId);
}

/**
 * Sede activa (de la cookie). Si la cookie es inválida o no existe,
 * usa la primera sede disponible. Null si el usuario no tiene sedes.
 */
export async function getActiveSedeId(user: SessionUser): Promise<string | null> {
  const sedes = await getSedesForUser(user);
  if (sedes.length === 0) return null;

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(SEDE_COOKIE)?.value;
  if (fromCookie && sedes.some((s) => s.id === fromCookie)) return fromCookie;
  return sedes[0].id;
}

/**
 * Exige una sede activa válida. Úsalo en las páginas de cada módulo
 * para obtener el `sedeId` por el que filtrar/crear registros.
 */
export async function requireActiveSede(user: SessionUser): Promise<string> {
  const sedeId = await getActiveSedeId(user);
  if (!sedeId) redirect("/sin-sede");
  return sedeId;
}

/**
 * Lanza si el usuario no puede operar sobre la sede dada.
 * Úsalo en server actions de creación/edición.
 */
export async function assertSedeAccess(
  user: SessionUser,
  sedeId: string,
): Promise<void> {
  if (!(await canAccessSede(user, sedeId))) {
    throw new Error("No tiene acceso a esta sede.");
  }
}

/**
 * El rol USUARIO solo opera Citas/Agenda y Sesiones: no ve pagos,
 * montos, ni el módulo de pacientes. Coordinador y administrador sí.
 * El TERAPEUTA tampoco ve pagos ni montos (sí la parte clínica, ver abajo).
 */
export function puedeVerPagos(user: SessionUser): boolean {
  return user.rol !== "USUARIO" && user.rol !== "TERAPEUTA";
}

/**
 * Lanza si el rol no puede operar los módulos de gestión (pagos y
 * pacientes). Úsalo en las server actions de esos módulos.
 */
export function assertRolGestion(user: SessionUser): void {
  if (!puedeVerPagos(user)) {
    throw new Error("No tiene permisos para esta operación.");
  }
}

/* ── Rol TERAPEUTA ─────────────────────────────────────── */

export function esTerapeuta(user: SessionUser): boolean {
  return user.rol === "TERAPEUTA";
}

/** Contexto del terapeuta; lanza si el usuario no es un terapeuta válido. */
export function terapeutaDe(user: SessionUser): TerapeutaContexto {
  if (!user.terapeuta) throw new Error("No tiene permisos para esta operación.");
  return user.terapeuta;
}

/**
 * ¿Tiene este permiso opcional? Solo restringe al TERAPEUTA: para los demás
 * roles es true y manda la regla propia de cada módulo.
 */
export function puede(user: SessionUser, permiso: PermisoTerapeuta): boolean {
  return tienePermiso(user.rol, user.terapeuta?.permisos ?? [], permiso);
}

export function assertPermiso(user: SessionUser, permiso: PermisoTerapeuta): void {
  if (!puede(user, permiso)) {
    throw new Error("No tiene permisos para esta operación.");
  }
}

/**
 * ¿Es una cita del propio terapeuta? Para los demás roles siempre es true
 * (el acceso por sede se valida aparte).
 */
export function esCitaPropia(
  user: SessionUser,
  cita: { terapeutaId: string | null },
): boolean {
  if (!esTerapeuta(user)) return true;
  return !!user.terapeuta && cita.terapeutaId === user.terapeuta.terapeutaId;
}

/** Lanza si un terapeuta intenta operar sobre una cita que no es suya. */
export function assertCitaPropia(
  user: SessionUser,
  cita: { terapeutaId: string | null },
): void {
  if (!esCitaPropia(user, cita)) {
    throw new Error("Esta cita no está asignada a usted.");
  }
}

/** Admin, coordinador y terapeuta ven la parte clínica; USUARIO no. */
export function puedeVerClinica(user: SessionUser): boolean {
  return user.rol !== "USUARIO";
}

/**
 * Filtro de pacientes que el usuario puede ver en la parte clínica. El
 * terapeuta ve los que atiende (con al menos una cita suya), o todos los de su
 * sede con VER_PACIENTES_SEDE. Para los demás roles no añade condición.
 */
export function whereMisPacientes(user: SessionUser): Prisma.PacienteWhereInput {
  if (!esTerapeuta(user) || puede(user, "VER_PACIENTES_SEDE")) return {};
  const terapeutaId = user.terapeuta?.terapeutaId ?? "";
  return { citas: { some: { terapeutaId } } };
}

/** ¿Puede ver la ficha clínica de este paciente? (sede + rol + si es suyo). */
export async function pacienteVisible(
  user: SessionUser,
  paciente: { id: string; sedeId: string },
): Promise<boolean> {
  if (!puedeVerClinica(user) || !(await canAccessSede(user, paciente.sedeId))) {
    return false;
  }
  const filtro = whereMisPacientes(user);
  if (Object.keys(filtro).length === 0) return true;
  const n = await prisma.paciente.count({
    where: { id: paciente.id, ...filtro },
  });
  return n > 0;
}

/** Para server actions clínicas: lanza si no puede ver al paciente. */
export async function assertAccesoClinico(
  user: SessionUser,
  pacienteId: string,
): Promise<{ id: string; sedeId: string }> {
  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { id: true, sedeId: true },
  });
  if (!paciente || !(await pacienteVisible(user, paciente))) {
    throw new Error("No tiene acceso a este paciente.");
  }
  return paciente;
}

/** Para páginas clínicas de un paciente: 404 si el usuario no puede verlo. */
export async function requireAccesoClinico(
  user: SessionUser,
  pacienteId: string,
): Promise<void> {
  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: { id: true, sedeId: true },
  });
  if (!paciente || !(await pacienteVisible(user, paciente))) notFound();
}

/**
 * ¿Puede editar este documento clínico (evaluación o informe)? El terapeuta
 * solo edita los que firmó él; los demás roles, cualquiera de su sede.
 */
export function esAutorClinico(
  user: SessionUser,
  evaluadorId: string | null,
): boolean {
  if (!esTerapeuta(user)) return true;
  return !!user.terapeuta && evaluadorId === user.terapeuta.terapeutaId;
}

/**
 * Evaluador con el que se guarda un documento clínico: el terapeuta siempre
 * queda como evaluador de lo que registra, sin importar lo que llegue del form.
 */
export function evaluadorParaGuardar(
  user: SessionUser,
  evaluadorId: string | undefined,
): string | undefined {
  if (!esTerapeuta(user)) return evaluadorId;
  return terapeutaDe(user).terapeutaId;
}

/** Evaluador fijo que se muestra en los formularios clínicos del terapeuta. */
export async function evaluadorFijoDe(
  user: SessionUser,
): Promise<{ id: string; nombre: string } | undefined> {
  if (!user.terapeuta) return undefined;
  const t = await prisma.terapeuta.findUnique({
    where: { id: user.terapeuta.terapeutaId },
    select: { id: true, nombres: true, apellidos: true },
  });
  return t ? { id: t.id, nombre: `${t.apellidos} ${t.nombres}` } : undefined;
}
