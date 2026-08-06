-- CreateTable
CREATE TABLE "Evaluacion" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "evaluadorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lugarNacimiento" TEXT,
    "numeroHermanos" TEXT,
    "nivelAcademico" TEXT,
    "centroEducativo" TEXT,
    "conviveMadre" BOOLEAN NOT NULL DEFAULT false,
    "convivePadre" BOOLEAN NOT NULL DEFAULT false,
    "conviveHermanos" BOOLEAN NOT NULL DEFAULT false,
    "conviveOtros" TEXT,
    "relacionDetalle" TEXT,
    "diagnostico" TEXT,
    "medicacion" TEXT,
    "terapiasRealiza" TEXT,
    "dificultadesDormir" TEXT,
    "dificultadesComer" TEXT,
    "dificultadesPresenta" TEXT,
    "preescolar" TEXT,
    "escolar" TEXT,
    "comportamientoAula" TEXT,
    "rendimientoEscolar" TEXT,
    "dificultadesEscolares" TEXT,
    "resultados" JSONB NOT NULL DEFAULT '{}',
    "modalidadLenguaje" TEXT,
    "observacionSensorial" TEXT,
    "observacionMotriz" TEXT,
    "observacionGeneral" TEXT,
    "programaRecomendado" "Programa",
    "recomendaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evaluacion_pacienteId_fecha_idx" ON "Evaluacion"("pacienteId", "fecha");

-- CreateIndex
CREATE INDEX "Evaluacion_sedeId_idx" ON "Evaluacion"("sedeId");

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_evaluadorId_fkey" FOREIGN KEY ("evaluadorId") REFERENCES "Terapeuta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
