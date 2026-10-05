-- Tratamiento sugerido en la evaluación inicial (solo agrega; no toca datos).


-- AlterTable
ALTER TABLE "Evaluacion" ADD COLUMN     "plazoSemanas" INTEGER NOT NULL DEFAULT 4;

-- CreateTable
CREATE TABLE "EvaluacionTerapia" (
    "id" TEXT NOT NULL,
    "evaluacionId" TEXT NOT NULL,
    "terapiaId" TEXT NOT NULL,
    "sesiones" INTEGER NOT NULL,
    "sesionesSemana" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EvaluacionTerapia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluacionTerapia_terapiaId_idx" ON "EvaluacionTerapia"("terapiaId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluacionTerapia_evaluacionId_terapiaId_key" ON "EvaluacionTerapia"("evaluacionId", "terapiaId");

-- AddForeignKey
ALTER TABLE "EvaluacionTerapia" ADD CONSTRAINT "EvaluacionTerapia_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionTerapia" ADD CONSTRAINT "EvaluacionTerapia_terapiaId_fkey" FOREIGN KEY ("terapiaId") REFERENCES "Terapia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

