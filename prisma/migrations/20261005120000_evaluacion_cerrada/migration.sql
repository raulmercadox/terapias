-- Evaluación cerrada: ya no sirve para crear ni renovar paquetes.
ALTER TABLE "Evaluacion" ADD COLUMN "cerradaEn" TIMESTAMP(3);
