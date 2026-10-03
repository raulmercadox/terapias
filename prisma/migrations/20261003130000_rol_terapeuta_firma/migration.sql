-- CreateEnum
CREATE TYPE "PermisoTerapeuta" AS ENUM ('CITA_AL_VUELO', 'PACIENTE_AL_VUELO', 'MOVER_CITAS', 'CANCELAR_CITAS', 'ELIMINAR_CITAS', 'REGISTRAR_COBRO', 'EDITAR_HISTORIA_CLINICA', 'EDITAR_DATOS_PACIENTE', 'VER_PACIENTES_SEDE', 'VER_AGENDA_SEDE');

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'TERAPEUTA';

-- AlterTable
ALTER TABLE "Terapeuta" ADD COLUMN     "firma" TEXT,
ADD COLUMN     "firmaActualizadaEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permisos" "PermisoTerapeuta"[] DEFAULT ARRAY[]::"PermisoTerapeuta"[],
ADD COLUMN     "terapeutaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_terapeutaId_key" ON "User"("terapeutaId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_terapeutaId_fkey" FOREIGN KEY ("terapeutaId") REFERENCES "Terapeuta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

