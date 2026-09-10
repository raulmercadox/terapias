-- AlterTable
ALTER TABLE "Interaccion" ADD COLUMN     "evaluacionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Interaccion_evaluacionId_key" ON "Interaccion"("evaluacionId");

-- AddForeignKey
ALTER TABLE "Interaccion" ADD CONSTRAINT "Interaccion_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

