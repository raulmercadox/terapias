"use server";

import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { EMPRESA_COOKIE } from "./constantes";

export async function authenticate(
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const empresa = String(formData.get("empresa") ?? "").trim().toLowerCase();

  // Se recuerda aunque la clave sea incorrecta: así el reintento ya la trae.
  const cookieStore = await cookies();
  cookieStore.set(EMPRESA_COOKIE, empresa, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });

  try {
    await signIn("credentials", {
      empresa,
      usuario: String(formData.get("usuario") ?? "").trim().toLowerCase(),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/panel",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Empresa, usuario o clave incorrectos.";
    }
    throw error; // re-lanza el redirect de Next
  }
}
