import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

process.loadEnvFile?.();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// En producción solo se crea el superadmin (con clave obligatoria por entorno);
// el centro demo, con su clave conocida, es solo para desarrollo.
const PRODUCCION = process.env.NODE_ENV === "production";

async function main() {
  // ── Superadmin de plataforma (sin centro) ─────────────
  // Entra con Empresa "plataforma". El @@unique no aplica con centroId NULL,
  // por eso se busca antes de crear.
  const superPassword =
    process.env.SEED_SUPERADMIN_PASSWORD ?? (PRODUCCION ? null : "admin123");
  if (!superPassword) {
    throw new Error("En producción define SEED_SUPERADMIN_PASSWORD para crear el superadmin.");
  }
  const superadmin = await prisma.user.findFirst({
    where: { centroId: null, usuario: "superadmin" },
  });
  if (!superadmin) {
    await prisma.user.create({
      data: {
        nombre: "Superadmin",
        usuario: "superadmin",
        passwordHash: await bcrypt.hash(superPassword, 10),
        rol: "SUPERADMIN",
      },
    });
  }

  if (PRODUCCION) {
    console.log("Seed completado. Plataforma: empresa 'plataforma' / usuario 'superadmin'");
    return;
  }

  // ── Centro de demostración ────────────────────────────
  const centro = await prisma.centro.upsert({
    where: { codigo: "demo" },
    update: {},
    create: { codigo: "demo", nombre: "Centro Demo", subtitulo: "Centro de terapias" },
  });
  const principal = await prisma.sede.upsert({
    where: { centroId_nombre: { centroId: centro.id, nombre: "Principal" } },
    update: {},
    create: { centroId: centro.id, nombre: "Principal" },
  });

  await prisma.user.upsert({
    where: { centroId_usuario: { centroId: centro.id, usuario: "admin" } },
    update: {},
    create: {
      centroId: centro.id,
      nombre: "Administrador",
      usuario: "admin",
      passwordHash: await bcrypt.hash("admin123", 10),
      rol: "ADMINISTRADOR",
    },
  });

  // ── Terapeutas de ejemplo ──────────────────────────────
  const terapeutas = [
    { nombres: "Ana", apellidos: "Ramírez", especialidad: "Terapia de lenguaje" },
    { nombres: "Luis", apellidos: "Torres", especialidad: "Terapia ocupacional" },
  ];
  for (const t of terapeutas) {
    const existe = await prisma.terapeuta.findFirst({
      where: { nombres: t.nombres, sedeId: principal.id },
    });
    if (!existe) await prisma.terapeuta.create({ data: { ...t, sedeId: principal.id } });
  }

  console.log(
    "Seed completado.\n" +
      "  Plataforma: empresa 'plataforma' / usuario 'superadmin'\n" +
      "  Centro demo: empresa 'demo' / usuario 'admin' / clave 'admin123'",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
