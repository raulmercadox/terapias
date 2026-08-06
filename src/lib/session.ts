import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Rol, Sede } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  nombre: string;
  email?: string | null;
  rol: Rol;
  sedeIds: string[];
};

const SEDE_COOKIE = "sede_activa";

/** Devuelve el usuario de la sesión o null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}

/** Exige sesión; redirige a /login si no hay. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Sedes que el usuario puede ver (admin = todas). */
export async function getSedesForUser(user: SessionUser): Promise<Sede[]> {
  if (user.rol === "ADMINISTRADOR") {
    return prisma.sede.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });
  }
  return prisma.sede.findMany({
    where: { id: { in: user.sedeIds }, activo: true },
    orderBy: { nombre: "asc" },
  });
}

/** ¿El usuario tiene acceso a esta sede? */
export function canAccessSede(user: SessionUser, sedeId: string): boolean {
  return user.rol === "ADMINISTRADOR" || user.sedeIds.includes(sedeId);
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
export function assertSedeAccess(user: SessionUser, sedeId: string): void {
  if (!canAccessSede(user, sedeId)) {
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
