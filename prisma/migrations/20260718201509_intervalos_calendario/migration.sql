-- AlterTable
ALTER TABLE "Sede" ADD COLUMN     "intervalosCalendario" INTEGER[] DEFAULT ARRAY[15, 30, 45, 60]::INTEGER[];
