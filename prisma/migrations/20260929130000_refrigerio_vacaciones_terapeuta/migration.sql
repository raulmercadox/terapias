-- AlterTable
ALTER TABLE "Terapeuta" ADD COLUMN     "refrigerioFin" TEXT,
ADD COLUMN     "refrigerioInicio" TEXT;

-- CreateTable
CREATE TABLE "VacacionTerapeuta" (
    "id" TEXT NOT NULL,
    "terapeutaId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacacionTerapeuta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VacacionTerapeuta_terapeutaId_fechaInicio_idx" ON "VacacionTerapeuta"("terapeutaId", "fechaInicio");

-- AddForeignKey
ALTER TABLE "VacacionTerapeuta" ADD CONSTRAINT "VacacionTerapeuta_terapeutaId_fkey" FOREIGN KEY ("terapeutaId") REFERENCES "Terapeuta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
