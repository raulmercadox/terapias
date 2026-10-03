-- CreateTable
CREATE TABLE "Especialidad" (
    "id" TEXT NOT NULL,
    "centroId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerapeutaEspecialidad" (
    "terapeutaId" TEXT NOT NULL,
    "especialidadId" TEXT NOT NULL,

    CONSTRAINT "TerapeutaEspecialidad_pkey" PRIMARY KEY ("terapeutaId","especialidadId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Especialidad_centroId_nombre_key" ON "Especialidad"("centroId", "nombre");

-- CreateIndex
CREATE INDEX "TerapeutaEspecialidad_especialidadId_idx" ON "TerapeutaEspecialidad"("especialidadId");

-- AddForeignKey
ALTER TABLE "Especialidad" ADD CONSTRAINT "Especialidad_centroId_fkey" FOREIGN KEY ("centroId") REFERENCES "Centro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerapeutaEspecialidad" ADD CONSTRAINT "TerapeutaEspecialidad_terapeutaId_fkey" FOREIGN KEY ("terapeutaId") REFERENCES "Terapeuta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerapeutaEspecialidad" ADD CONSTRAINT "TerapeutaEspecialidad_especialidadId_fkey" FOREIGN KEY ("especialidadId") REFERENCES "Especialidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Datos: el texto libre de Terapeuta.especialidad pasa al catálogo de su
-- centro (sin distinguir mayúsculas) y cada terapeuta queda vinculado a la suya.
INSERT INTO "Especialidad" ("id", "centroId", "nombre", "activo", "createdAt", "updatedAt")
SELECT 'esp_' || md5(s."centroId" || '|' || s.clave), s."centroId", s.nombre, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT se."centroId", lower(trim(t."especialidad")) AS clave, min(trim(t."especialidad")) AS nombre
    FROM "Terapeuta" t
    JOIN "Sede" se ON se."id" = t."sedeId"
    WHERE t."especialidad" IS NOT NULL AND trim(t."especialidad") <> ''
    GROUP BY se."centroId", lower(trim(t."especialidad"))
) s;

INSERT INTO "TerapeutaEspecialidad" ("terapeutaId", "especialidadId")
SELECT t."id", 'esp_' || md5(se."centroId" || '|' || lower(trim(t."especialidad")))
FROM "Terapeuta" t
JOIN "Sede" se ON se."id" = t."sedeId"
WHERE t."especialidad" IS NOT NULL AND trim(t."especialidad") <> '';

-- AlterTable
ALTER TABLE "Terapeuta" DROP COLUMN "especialidad";
