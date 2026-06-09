-- CreateTable
CREATE TABLE "ObservacionSesion" (
    "id" TEXT NOT NULL,
    "citaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservacionSesion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObservacionSesion_citaId_createdAt_idx" ON "ObservacionSesion"("citaId", "createdAt");

-- AddForeignKey
ALTER TABLE "ObservacionSesion" ADD CONSTRAINT "ObservacionSesion_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
