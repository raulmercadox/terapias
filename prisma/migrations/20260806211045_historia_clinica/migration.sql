-- CreateTable
CREATE TABLE "HistoriaClinica" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lugarNacimiento" TEXT,
    "padreApoderado" TEXT,
    "familiares" JSONB NOT NULL DEFAULT '[]',
    "historiaPrePostnatal" TEXT,
    "presentacionDificultad" TEXT,
    "signosSintomas" TEXT,
    "tempranaCentro" TEXT,
    "tempranaAdaptacion" TEXT,
    "kinderCentro" TEXT,
    "kinderAdaptacion" TEXT,
    "evolucionMejoria" TEXT,
    "examenesRealizados" TEXT,
    "tratamientosRecibidos" TEXT,
    "indicacionesDoctor" TEXT,
    "medicinasRecomendadas" TEXT,
    "dosis" TEXT,
    "tiempoInicio" TEXT,
    "mejoriaMedicacion" TEXT,
    "alimentacion" TEXT,
    "controlEsfinteres" TEXT,
    "sueno" TEXT,
    "autonomiaPersonal" TEXT,
    "reaccionRechazo" BOOLEAN NOT NULL DEFAULT false,
    "reaccionIndiferencia" BOOLEAN NOT NULL DEFAULT false,
    "reaccionAceptacion" BOOLEAN NOT NULL DEFAULT false,
    "reaccionPreocupacion" BOOLEAN NOT NULL DEFAULT false,
    "reaccionVerguenza" BOOLEAN NOT NULL DEFAULT false,
    "reaccionDetalle" TEXT,
    "creencias" TEXT,
    "cambiosCrianza" TEXT,
    "usoCastigo" TEXT,
    "comportamientoApego" TEXT,
    "enfermedadesFamiliares" TEXT,
    "caracterPadres" TEXT,
    "observacionesEntrevista" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoriaClinica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HistoriaClinica_pacienteId_key" ON "HistoriaClinica"("pacienteId");

-- CreateIndex
CREATE INDEX "HistoriaClinica_sedeId_idx" ON "HistoriaClinica"("sedeId");

-- AddForeignKey
ALTER TABLE "HistoriaClinica" ADD CONSTRAINT "HistoriaClinica_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriaClinica" ADD CONSTRAINT "HistoriaClinica_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
