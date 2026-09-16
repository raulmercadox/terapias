/*
  Warnings:

  - You are about to drop the column `alimentacion` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `autonomiaPersonal` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `cambiosCrianza` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `caracterPadres` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `comportamientoApego` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `controlEsfinteres` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `creencias` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `dosis` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `enfermedadesFamiliares` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `evolucionMejoria` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `examenesRealizados` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `familiares` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `historiaPrePostnatal` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `indicacionesDoctor` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `kinderAdaptacion` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `kinderCentro` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `lugarNacimiento` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `medicinasRecomendadas` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `mejoriaMedicacion` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `observacionesEntrevista` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `padreApoderado` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `presentacionDificultad` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `reaccionAceptacion` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `reaccionDetalle` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `reaccionIndiferencia` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `reaccionPreocupacion` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `reaccionRechazo` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `reaccionVerguenza` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `signosSintomas` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `sueno` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `tempranaAdaptacion` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `tempranaCentro` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `tiempoInicio` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `tratamientosRecibidos` on the `HistoriaClinica` table. All the data in the column will be lost.
  - You are about to drop the column `usoCastigo` on the `HistoriaClinica` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "HistoriaClinica" DROP COLUMN "alimentacion",
DROP COLUMN "autonomiaPersonal",
DROP COLUMN "cambiosCrianza",
DROP COLUMN "caracterPadres",
DROP COLUMN "comportamientoApego",
DROP COLUMN "controlEsfinteres",
DROP COLUMN "creencias",
DROP COLUMN "dosis",
DROP COLUMN "enfermedadesFamiliares",
DROP COLUMN "evolucionMejoria",
DROP COLUMN "examenesRealizados",
DROP COLUMN "familiares",
DROP COLUMN "historiaPrePostnatal",
DROP COLUMN "indicacionesDoctor",
DROP COLUMN "kinderAdaptacion",
DROP COLUMN "kinderCentro",
DROP COLUMN "lugarNacimiento",
DROP COLUMN "medicinasRecomendadas",
DROP COLUMN "mejoriaMedicacion",
DROP COLUMN "observacionesEntrevista",
DROP COLUMN "padreApoderado",
DROP COLUMN "presentacionDificultad",
DROP COLUMN "reaccionAceptacion",
DROP COLUMN "reaccionDetalle",
DROP COLUMN "reaccionIndiferencia",
DROP COLUMN "reaccionPreocupacion",
DROP COLUMN "reaccionRechazo",
DROP COLUMN "reaccionVerguenza",
DROP COLUMN "signosSintomas",
DROP COLUMN "sueno",
DROP COLUMN "tempranaAdaptacion",
DROP COLUMN "tempranaCentro",
DROP COLUMN "tiempoInicio",
DROP COLUMN "tratamientosRecibidos",
DROP COLUMN "usoCastigo",
ADD COLUMN     "valores" JSONB NOT NULL DEFAULT '{}';
