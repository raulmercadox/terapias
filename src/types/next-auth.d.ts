import type { Rol } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nombre: string;
      rol: Rol;
      sedeIds: string[];
    } & DefaultSession["user"];
  }

  interface User {
    nombre?: string;
    rol?: Rol;
    sedeIds?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol?: Rol;
    sedeIds?: string[];
    nombre?: string;
  }
}
