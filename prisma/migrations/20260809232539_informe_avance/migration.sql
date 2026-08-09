-- CreateTable
CREATE TABLE "InformeAvance" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "evaluadorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "secciones" JSONB NOT NULL DEFAULT '[]',
    "recomendaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InformeAvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InformeAvance_pacienteId_fecha_idx" ON "InformeAvance"("pacienteId", "fecha");

-- CreateIndex
CREATE INDEX "InformeAvance_sedeId_idx" ON "InformeAvance"("sedeId");

-- AddForeignKey
ALTER TABLE "InformeAvance" ADD CONSTRAINT "InformeAvance_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeAvance" ADD CONSTRAINT "InformeAvance_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeAvance" ADD CONSTRAINT "InformeAvance_evaluadorId_fkey" FOREIGN KEY ("evaluadorId") REFERENCES "Terapeuta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
