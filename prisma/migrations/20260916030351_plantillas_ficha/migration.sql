-- CreateEnum
CREATE TYPE "TipoFicha" AS ENUM ('HISTORIA', 'EVALUACION', 'INFORME');

-- CreateTable
CREATE TABLE "PlantillaFicha" (
    "id" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "tipo" "TipoFicha" NOT NULL,
    "base" TEXT NOT NULL DEFAULT 'psicologica',
    "version" INTEGER NOT NULL DEFAULT 1,
    "secciones" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantillaFicha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaFicha_centroId_tipo_key" ON "PlantillaFicha"("centroId", "tipo");

-- AddForeignKey
ALTER TABLE "PlantillaFicha" ADD CONSTRAINT "PlantillaFicha_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "Centro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
