// Seed idempotente: asegura una terapia "Terapia Individual" por sede
// y fija el horario laboral a 09:00–18:00, Lun–Sáb (getDay 1..6).
// Ejecutar con: node --env-file=.env prisma/seed-programas.mjs
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const HORARIO = {
  horaApertura: "09:00",
  horaCierre: "18:00",
  diasLaborales: [1, 2, 3, 4, 5, 6], // Lun–Sáb
};

try {
  const sedes = await prisma.sede.findMany({ select: { id: true, nombre: true } });
  if (sedes.length === 0) {
    console.log("No hay sedes. Nada que sembrar.");
  }
  for (const s of sedes) {
    await prisma.sede.update({ where: { id: s.id }, data: HORARIO });
    await prisma.terapia.upsert({
      where: { sedeId_nombre: { sedeId: s.id, nombre: "Terapia Individual" } },
      update: { activo: true },
      create: {
        sedeId: s.id,
        nombre: "Terapia Individual",
        modalidad: "INDIVIDUAL",
        duracionMin: 45,
        maxParticipantes: 1,
        activo: true,
      },
    });
    console.log(`✓ Sede "${s.nombre}": horario 09:00–18:00 Lun–Sáb + terapia Terapia Individual`);
  }
  console.log("Seed completado.");
} finally {
  await prisma.$disconnect();
}
