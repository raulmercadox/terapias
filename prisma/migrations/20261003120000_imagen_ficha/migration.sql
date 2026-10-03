-- CreateTable
CREATE TABLE "ImagenFicha" (
    "id" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "datos" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImagenFicha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImagenFicha_centroId_idx" ON "ImagenFicha"("centroId");

-- AddForeignKey
ALTER TABLE "ImagenFicha" ADD CONSTRAINT "ImagenFicha_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "Centro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

