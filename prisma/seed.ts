import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

process.loadEnvFile?.();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Sedes ──────────────────────────────────────────────
  const sjl = await prisma.sede.upsert({
    where: { nombre: "SJL" },
    update: {},
    create: { nombre: "SJL", direccion: "San Juan de Lurigancho" },
  });
  const jicamarca = await prisma.sede.upsert({
    where: { nombre: "Jicamarca" },
    update: {},
    create: { nombre: "Jicamarca", direccion: "Jicamarca" },
  });

  // ── Usuario administrador ──────────────────────────────
  const adminEmail = "admin@bgenius.pe";
  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      nombre: "Administrador",
      email: adminEmail,
      passwordHash,
      rol: "ADMINISTRADOR",
    },
  });

  // ── Terapeutas de ejemplo ──────────────────────────────
  const terapeutas = [
    { nombres: "Marita", apellidos: "(Lic.)", sedeId: sjl.id, especialidad: "Terapia de lenguaje" },
    { nombres: "Diana", apellidos: "(Lic.)", sedeId: sjl.id, especialidad: "Terapia conductual" },
    { nombres: "Katerine", apellidos: "(Lic.)", sedeId: jicamarca.id, especialidad: "Terapia ocupacional" },
  ];
  for (const t of terapeutas) {
    const existe = await prisma.terapeuta.findFirst({
      where: { nombres: t.nombres, sedeId: t.sedeId },
    });
    if (!existe) await prisma.terapeuta.create({ data: t });
  }

  console.log("Seed completado. Admin: admin@bgenius.pe / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
