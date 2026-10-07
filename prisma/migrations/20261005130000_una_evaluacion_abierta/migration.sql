-- Solo una evaluación abierta por paciente: se deja abierta la más reciente
-- (por fecha y, a igual fecha, la última registrada) y se cierran las demás.
UPDATE "Evaluacion" e
SET "cerradaEn" = NOW()
WHERE e."cerradaEn" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Evaluacion" o
    WHERE o."pacienteId" = e."pacienteId"
      AND o."cerradaEn" IS NULL
      AND (o."fecha", o."createdAt", o."id") > (e."fecha", e."createdAt", e."id")
  );
