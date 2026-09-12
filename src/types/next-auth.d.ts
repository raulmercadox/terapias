import type { Rol } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nombre: string;
      usuario: string;
      rol: Rol;
      centroId: string | null; // null solo para SUPERADMIN
      sedeIds: string[];
    } & DefaultSession["user"];
  }

  interface User {
    nombre?: string;
    usuario?: string;
    rol?: Rol;
    centroId?: string | null;
    sedeIds?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol?: Rol;
    sedeIds?: string[];
    nombre?: string;
    usuario?: string;
    centroId?: string | null;
  }
}
