-- CreateEnum
CREATE TYPE "TipoGracia" AS ENUM ('PORCENTAJE', 'DIAS');

-- CreateTable
CREATE TABLE "Configuracion" (
    "centroId" TEXT NOT NULL,
    "graciaTipo" "TipoGracia" NOT NULL DEFAULT 'PORCENTAJE',
    "graciaValor" INTEGER NOT NULL DEFAULT 50,
    "diasAvisoCobro" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("centroId")
);

-- AddForeignKey
ALTER TABLE "Configuracion" ADD CONSTRAINT "Configuracion_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "Centro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
