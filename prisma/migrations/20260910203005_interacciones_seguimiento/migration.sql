-- CreateEnum
CREATE TYPE "DireccionInteraccion" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "CanalInteraccion" AS ENUM ('LLAMADA', 'WHATSAPP', 'VISITA', 'EVALUACION', 'CORREO', 'REDES', 'OTRO');

-- CreateEnum
CREATE TYPE "ResultadoSalida" AS ENUM ('CONTACTADO', 'SIN_RESPUESTA');

-- CreateTable
CREATE TABLE "Interaccion" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "direccion" "DireccionInteraccion" NOT NULL,
    "canal" "CanalInteraccion" NOT NULL DEFAULT 'LLAMADA',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" "ResultadoSalida",
    "nota" TEXT,
    "autor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interaccion_sedeId_direccion_fecha_idx" ON "Interaccion"("sedeId", "direccion", "fecha");

-- CreateIndex
CREATE INDEX "Interaccion_pacienteId_fecha_idx" ON "Interaccion"("pacienteId", "fecha");

-- AddForeignKey
ALTER TABLE "Interaccion" ADD CONSTRAINT "Interaccion_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaccion" ADD CONSTRAINT "Interaccion_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
