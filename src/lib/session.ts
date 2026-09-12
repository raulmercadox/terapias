import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Rol, Sede } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Usuario tal como viene en la sesión (el SUPERADMIN no tiene centro). */
export type UsuarioSesion = {
  id: string;
  nombre: string;
  usuario: string;
  rol: Rol;
  centroId: string | null;
  sedeIds: string[];
};

/** Usuario de un centro: el que operan todos los módulos de la app. */
export type SessionUser = UsuarioSesion & { centroId: string };

const SEDE_COOKIE = "sede_activa";

/** Devuelve el usuario de la sesión o null. */
export async function getCurrentUser(): Promise<UsuarioSesion | null> {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Exige sesión de un usuario de centro; redirige a /login si no hay. El
 * superadmin no opera centros: se le manda a su panel.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol === "SUPERADMIN" || !user.centroId) redirect("/plataforma");
  return user as SessionUser;
}

/** Exige sesión de SUPERADMIN. Úsalo en el panel /plataforma y sus acciones. */
export async function requireSuperadmin(): Promise<UsuarioSesion> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol !== "SUPERADMIN") redirect("/");
  return user;
}

/** Datos de marca del centro. Memoizado por request. */
export const getCentro = cache(async (centroId: string) =>
  prisma.centro.findUniqueOrThrow({
    where: { id: centroId },
    select: { id: true, codigo: true, nombre: true, subtitulo: true, activo: true },
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
 */
export function puedeVerPagos(user: SessionUser): boolean {
  return user.rol !== "USUARIO";
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
