"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";

export async function setActiveSede(sedeId: string) {
  const cookieStore = await cookies();
  cookieStore.set("sede_activa", sedeId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

export async function cerrarSesion() {
  await signOut({ redirectTo: "/login" });
}
