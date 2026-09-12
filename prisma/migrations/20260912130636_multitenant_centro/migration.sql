-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'SUPERADMIN';

-- DropIndex
DROP INDEX "Sede_nombre_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Sede" ADD COLUMN     "centroId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "centroId" TEXT,
ADD COLUMN     "usuario" TEXT NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Centro" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "subtitulo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Centro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Centro_codigo_key" ON "Centro"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Sede_centroId_nombre_key" ON "Sede"("centroId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "User_centroId_usuario_key" ON "User"("centroId", "usuario");

-- AddForeignKey
ALTER TABLE "Sede" ADD CONSTRAINT "Sede_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "Centro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "Centro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

