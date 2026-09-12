import type { NextAuthConfig } from "next-auth";
import type { Rol } from "@prisma/client";

/**
 * Configuración base, segura para el runtime "edge" (no importa Prisma).
 * La usa el proxy para proteger rutas. El proveedor de credenciales
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
    // Chequeo optimista: las páginas y acciones vuelven a validar el rol
    // (requireUser / requireSuperadmin en lib/session).
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      if (!isLoggedIn) return false;

      // El superadmin solo usa /plataforma; los usuarios de centro, nunca.
      const esSuperadmin = auth.user.rol === "SUPERADMIN";
      const enPlataforma = nextUrl.pathname.startsWith("/plataforma");
      if (esSuperadmin && !enPlataforma) {
        return Response.redirect(new URL("/plataforma", nextUrl));
      }
      if (!esSuperadmin && enPlataforma) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.rol = user.rol;
        token.sedeIds = user.sedeIds;
        token.nombre = user.nombre;
        token.usuario = user.usuario;
        token.centroId = user.centroId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.rol = (token.rol as Rol) ?? "USUARIO";
        session.user.sedeIds = (token.sedeIds as string[]) ?? [];
        session.user.usuario = (token.usuario as string) ?? "";
        session.user.centroId = (token.centroId as string | null) ?? null;
        session.user.nombre =
          (token.nombre as string) ?? session.user.usuario ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
