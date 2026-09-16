/**
 * Restablece la clave del superadmin de plataforma (el que entra con la empresa
 * "plataforma" y da de alta centros).
 *
 *   NUEVA_CLAVE='...' npm run reset-superadmin
 *
 * Existe porque el seed solo crea esa cuenta `if (!superadmin)`: no tiene rama
 * de actualización, así que reejecutarlo no sirve para cambiar la clave de una
 * cuenta que ya existe.
 *
 * La clave se lee del entorno, no de los argumentos, para que no quede en el
 * historial del shell ni sea visible en `ps`.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile?.();
} catch {
  // Sin archivo .env: se usan las variables que ya vengan del entorno.
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USUARIO = process.env.SUPERADMIN_USUARIO ?? "superadmin";
const CLAVE = process.env.NUEVA_CLAVE;
const MINIMO = 12;

async function main() {
  if (!CLAVE) {
    throw new Error(
      "Define NUEVA_CLAVE. Ejemplo:\n" +
        "  NUEVA_CLAVE='una clave larga' npm run reset-superadmin",
    );
  }
  if (CLAVE.length < MINIMO) {
    throw new Error(`NUEVA_CLAVE debe tener al menos ${MINIMO} caracteres.`);
  }

  // El @@unique([centroId, usuario]) no aplica cuando centroId es NULL, que es
  // justo el caso del superadmin: por eso se busca con findFirst y se actualiza
  // por id, no por la clave compuesta.
  const admin = await prisma.user.findFirst({
    where: { centroId: null, usuario: USUARIO, rol: "SUPERADMIN" },
  });
  if (!admin) {
    throw new Error(
      `No existe ningún superadmin con el usuario '${USUARIO}'.\n` +
        "Si el usuario es otro, pásalo en SUPERADMIN_USUARIO.",
    );
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(CLAVE, 10) },
  });

  console.log(`Clave restablecida para el superadmin '${USUARIO}'.`);
  if (!admin.activo) {
    // No se reactiva sola: cambiar la clave no debería, de paso, devolver el
    // acceso a una cuenta que alguien desactivó a propósito.
    console.log("Aviso: la cuenta está desactivada, así que aún no podrá entrar.");
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
