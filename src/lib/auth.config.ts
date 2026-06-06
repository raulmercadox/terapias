import type { NextAuthConfig } from "next-auth";
import type { Rol } from "@prisma/client";

/**
 * Configuración base, segura para el runtime "edge" (no importa Prisma).
 * La usa el middleware para proteger rutas. El proveedor de credenciales
 * (que sí consulta la BD) se añade en `auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.rol = user.rol;
        token.sedeIds = user.sedeIds;
        token.nombre = user.nombre;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.rol = (token.rol as Rol) ?? "USUARIO";
        session.user.sedeIds = (token.sedeIds as string[]) ?? [];
        session.user.nombre =
          (token.nombre as string) ?? session.user.email ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
