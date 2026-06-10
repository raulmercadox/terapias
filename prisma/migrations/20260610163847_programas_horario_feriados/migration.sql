-- AlterTable
ALTER TABLE "Paquete" ADD COLUMN     "horarioSemanal" JSONB,
ADD COLUMN     "programaId" TEXT;

-- AlterTable
ALTER TABLE "Sede" ADD COLUMN     "diasLaborales" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
ADD COLUMN     "horaApertura" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "horaCierre" TEXT NOT NULL DEFAULT '13:00';

-- CreateTable
CREATE TABLE "ProgramaTerapia" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "duracionMin" INTEGER NOT NULL DEFAULT 45,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramaTerapia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feriado" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feriado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramaTerapia_sedeId_idx" ON "ProgramaTerapia"("sedeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramaTerapia_sedeId_nombre_key" ON "ProgramaTerapia"("sedeId", "nombre");

-- CreateIndex
CREATE INDEX "Feriado_sedeId_fecha_idx" ON "Feriado"("sedeId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Feriado_sedeId_fecha_key" ON "Feriado"("sedeId", "fecha");

-- CreateIndex
CREATE INDEX "Paquete_programaId_idx" ON "Paquete"("programaId");

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaTerapia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramaTerapia" ADD CONSTRAINT "ProgramaTerapia_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feriado" ADD CONSTRAINT "Feriado_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;
