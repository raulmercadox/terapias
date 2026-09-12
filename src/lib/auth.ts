import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

/** Código de empresa reservado para entrar al panel de plataforma. */
export const EMPRESA_PLATAFORMA = "plataforma";

const credentialsSchema = z.object({
  empresa: z.string().trim().toLowerCase().min(1),
  usuario: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

/** Busca al usuario activo que corresponde a empresa + usuario. */
async function buscarUsuario(empresa: string, usuario: string) {
  if (empresa === EMPRESA_PLATAFORMA) {
    return prisma.user.findFirst({
      where: { centroId: null, usuario, rol: "SUPERADMIN", activo: true },
      include: { sedes: true },
    });
  }
  const centro = await prisma.centro.findUnique({
    where: { codigo: empresa },
    select: { id: true, activo: true },
  });
  if (!centro?.activo) return null;
  return prisma.user.findFirst({
    where: { centroId: centro.id, usuario, activo: true },
    include: { sedes: true },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        empresa: { label: "Empresa", type: "text" },
        usuario: { label: "Usuario", type: "text" },
        password: { label: "Clave", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { empresa, usuario, password } = parsed.data;
        const user = await buscarUsuario(empresa, usuario);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          usuario: user.usuario,
          rol: user.rol,
          centroId: user.centroId,
          sedeIds: user.sedes.map((s) => s.sedeId),
        };
      },
    }),
  ],
});
