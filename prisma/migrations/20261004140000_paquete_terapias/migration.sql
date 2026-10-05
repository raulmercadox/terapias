-- Un paquete pasa a tener una línea por terapia (PaqueteTerapia), cada una con
-- su terapeuta y sus sesiones. Los paquetes existentes quedan con una sola
-- línea que hereda la terapia, frecuencia y horario del paquete.

-- CreateTable
CREATE TABLE "PaqueteTerapia" (
    "id" TEXT NOT NULL,
    "paqueteId" TEXT NOT NULL,
    "terapiaId" TEXT,
    "terapeutaId" TEXT,
    "totalSesiones" INTEGER NOT NULL,
    "frecuenciaSemana" INTEGER NOT NULL DEFAULT 1,
    "horarioSemanal" JSONB,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaqueteTerapia_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Cita" ADD COLUMN "paqueteTerapiaId" TEXT;
ALTER TABLE "Paquete" ADD COLUMN "evaluacionId" TEXT;

-- Datos: una línea por paquete. El terapeuta es el de su última sesión no
-- cancelada (el mismo criterio que usaba la renovación); si todas están
-- canceladas, el de su última sesión.
INSERT INTO "PaqueteTerapia" ("id", "paqueteId", "terapiaId", "terapeutaId", "totalSesiones", "frecuenciaSemana", "horarioSemanal", "orden")
SELECT
    'pt_' || md5(p."id"),
    p."id",
    p."programaId",
    (
        SELECT c."terapeutaId" FROM "Cita" c
        WHERE c."paqueteId" = p."id" AND c."terapeutaId" IS NOT NULL
        ORDER BY (c."estado" = 'CANCELADA'), c."fecha" DESC, c."horaInicio" DESC
        LIMIT 1
    ),
    p."totalSesiones",
    GREATEST(p."frecuenciaSemana", 1),
    p."horarioSemanal",
    0
FROM "Paquete" p;

UPDATE "Cita" c SET "paqueteTerapiaId" = 'pt_' || md5(c."paqueteId")
WHERE c."paqueteId" IS NOT NULL;

-- DropForeignKey / DropIndex / AlterTable: lo que pasó a la línea
ALTER TABLE "Paquete" DROP CONSTRAINT "Paquete_programaId_fkey";
DROP INDEX "Paquete_programaId_idx";
ALTER TABLE "Paquete" DROP COLUMN "frecuenciaSemana",
DROP COLUMN "horarioSemanal",
DROP COLUMN "programaId";

-- CreateIndex
CREATE INDEX "PaqueteTerapia_paqueteId_idx" ON "PaqueteTerapia"("paqueteId");
CREATE INDEX "PaqueteTerapia_terapiaId_idx" ON "PaqueteTerapia"("terapiaId");
CREATE INDEX "PaqueteTerapia_terapeutaId_idx" ON "PaqueteTerapia"("terapeutaId");
CREATE INDEX "Cita_paqueteTerapiaId_idx" ON "Cita"("paqueteTerapiaId");
CREATE INDEX "Paquete_evaluacionId_idx" ON "Paquete"("evaluacionId");

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaqueteTerapia" ADD CONSTRAINT "PaqueteTerapia_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "Paquete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaqueteTerapia" ADD CONSTRAINT "PaqueteTerapia_terapiaId_fkey" FOREIGN KEY ("terapiaId") REFERENCES "Terapia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaqueteTerapia" ADD CONSTRAINT "PaqueteTerapia_terapeutaId_fkey" FOREIGN KEY ("terapeutaId") REFERENCES "Terapeuta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_paqueteTerapiaId_fkey" FOREIGN KEY ("paqueteTerapiaId") REFERENCES "PaqueteTerapia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
