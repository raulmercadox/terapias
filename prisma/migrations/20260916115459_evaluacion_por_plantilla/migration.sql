/*
  Warnings:

  - You are about to drop the column `centroEducativo` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `comportamientoAula` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `conviveHermanos` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `conviveMadre` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `conviveOtros` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `convivePadre` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `diagnostico` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `dificultadesComer` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `dificultadesDormir` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `dificultadesEscolares` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `dificultadesPresenta` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `escolar` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `lugarNacimiento` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `medicacion` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `modalidadLenguaje` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `nivelAcademico` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `numeroHermanos` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `observacionGeneral` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `observacionMotriz` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `observacionSensorial` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `preescolar` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `relacionDetalle` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `rendimientoEscolar` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `resultados` on the `Evaluacion` table. All the data in the column will be lost.
  - You are about to drop the column `terapiasRealiza` on the `Evaluacion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Evaluacion" DROP COLUMN "centroEducativo",
DROP COLUMN "comportamientoAula",
DROP COLUMN "conviveHermanos",
DROP COLUMN "conviveMadre",
DROP COLUMN "conviveOtros",
DROP COLUMN "convivePadre",
DROP COLUMN "diagnostico",
DROP COLUMN "dificultadesComer",
DROP COLUMN "dificultadesDormir",
DROP COLUMN "dificultadesEscolares",
DROP COLUMN "dificultadesPresenta",
DROP COLUMN "escolar",
DROP COLUMN "lugarNacimiento",
DROP COLUMN "medicacion",
DROP COLUMN "modalidadLenguaje",
DROP COLUMN "nivelAcademico",
DROP COLUMN "numeroHermanos",
DROP COLUMN "observacionGeneral",
DROP COLUMN "observacionMotriz",
DROP COLUMN "observacionSensorial",
DROP COLUMN "preescolar",
DROP COLUMN "relacionDetalle",
DROP COLUMN "rendimientoEscolar",
DROP COLUMN "resultados",
DROP COLUMN "terapiasRealiza",
ADD COLUMN     "estructura" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "plantillaVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "valores" JSONB NOT NULL DEFAULT '{}';
