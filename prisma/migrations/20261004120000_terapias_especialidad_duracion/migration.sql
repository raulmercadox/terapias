-- Los "programas" pasan a ser Terapias: cada una con especialidad y modalidad
-- (individual/grupal). Conservan su duración de sesión.
-- Se renombra la tabla para conservar los ids (los paquetes la referencian).

-- CreateEnum
CREATE TYPE "ModalidadTerapia" AS ENUM ('INDIVIDUAL', 'GRUPAL');

-- Rename ProgramaTerapia -> Terapia (con sus restricciones e índices)
ALTER TABLE "ProgramaTerapia" RENAME TO "Terapia";
ALTER TABLE "Terapia" RENAME CONSTRAINT "ProgramaTerapia_pkey" TO "Terapia_pkey";
ALTER TABLE "Terapia" RENAME CONSTRAINT "ProgramaTerapia_sedeId_fkey" TO "Terapia_sedeId_fkey";
ALTER INDEX "ProgramaTerapia_sedeId_idx" RENAME TO "Terapia_sedeId_idx";
ALTER INDEX "ProgramaTerapia_sedeId_nombre_key" RENAME TO "Terapia_sedeId_nombre_key";

-- AlterTable: modalidad y participantes
ALTER TABLE "Terapia" RENAME COLUMN "maxPacientes" TO "maxParticipantes";
ALTER TABLE "Terapia" ADD COLUMN "modalidad" "ModalidadTerapia" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN "especialidadId" TEXT;
UPDATE "Terapia" SET "modalidad" = 'GRUPAL' WHERE "maxParticipantes" > 1;

-- AlterTable: terapia de cada cita (las de paquete heredan la del paquete)
ALTER TABLE "Cita" ADD COLUMN "terapiaId" TEXT;
UPDATE "Cita" c SET "terapiaId" = p."programaId"
FROM "Paquete" p
WHERE p."id" = c."paqueteId" AND p."programaId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Terapia_especialidadId_idx" ON "Terapia"("especialidadId");
CREATE INDEX "Cita_terapiaId_idx" ON "Cita"("terapiaId");

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_terapiaId_fkey" FOREIGN KEY ("terapiaId") REFERENCES "Terapia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Terapia" ADD CONSTRAINT "Terapia_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "Especialidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
