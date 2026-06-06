-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMINISTRADOR', 'COORDINADOR', 'USUARIO');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "EstadoPaciente" AS ENUM ('ACTIVO', 'BAJA');

-- CreateEnum
CREATE TYPE "Programa" AS ENUM ('ESCOLAR', 'INTERDIARIO', 'TERAPIAS');

-- CreateEnum
CREATE TYPE "Vinculo" AS ENUM ('MADRE', 'PADRE', 'APODERADO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoCita" AS ENUM ('CONSULTA', 'EVALUACION', 'SESION');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('AGENDADA', 'ATENDIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "Asistencia" AS ENUM ('PENDIENTE', 'ASISTIO', 'FALTO', 'TARDANZA');

-- CreateEnum
CREATE TYPE "EstadoPaquete" AS ENUM ('ACTIVO', 'COMPLETADO', 'VENCIDO', 'ANULADO');

-- CreateEnum
CREATE TYPE "ConceptoPago" AS ENUM ('MATRICULA', 'MATERIALES', 'MENSUALIDAD', 'PAQUETE_SESIONES', 'EVALUACION', 'OTRO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA');

-- CreateTable
CREATE TABLE "Sede" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'USUARIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSede" (
    "userId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,

    CONSTRAINT "UserSede_pkey" PRIMARY KEY ("userId","sedeId")
);

-- CreateTable
CREATE TABLE "Terapeuta" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "especialidad" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Terapeuta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT,
    "dni" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "sexo" "Sexo",
    "telefono" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "distrito" TEXT,
    "fotoUrl" TEXT,
    "programa" "Programa" NOT NULL DEFAULT 'TERAPIAS',
    "diagnostico" TEXT,
    "estado" "EstadoPaciente" NOT NULL DEFAULT 'ACTIVO',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apoderado" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT,
    "dni" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "vinculo" "Vinculo" NOT NULL DEFAULT 'APODERADO',
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apoderado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paquete" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "totalSesiones" INTEGER NOT NULL DEFAULT 12,
    "frecuenciaSemana" INTEGER NOT NULL DEFAULT 3,
    "precio" DECIMAL(10,2) NOT NULL,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "estado" "EstadoPaquete" NOT NULL DEFAULT 'ACTIVO',
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cita" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "terapeutaId" TEXT,
    "paqueteId" TEXT,
    "numeroSesion" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "tipo" "TipoCita" NOT NULL DEFAULT 'SESION',
    "estado" "EstadoCita" NOT NULL DEFAULT 'AGENDADA',
    "asistencia" "Asistencia" NOT NULL DEFAULT 'PENDIENTE',
    "terapiaRealizada" TEXT,
    "observacion" TEXT,
    "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "paqueteId" TEXT,
    "numeroRecibo" TEXT NOT NULL,
    "concepto" "ConceptoPago" NOT NULL DEFAULT 'PAQUETE_SESIONES',
    "descripcion" TEXT,
    "monto" DECIMAL(10,2) NOT NULL,
    "saldo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "referencia" TEXT,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sede_nombre_key" ON "Sede"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserSede_sedeId_idx" ON "UserSede"("sedeId");

-- CreateIndex
CREATE INDEX "Terapeuta_sedeId_idx" ON "Terapeuta"("sedeId");

-- CreateIndex
CREATE INDEX "Paciente_sedeId_idx" ON "Paciente"("sedeId");

-- CreateIndex
CREATE INDEX "Paciente_dni_idx" ON "Paciente"("dni");

-- CreateIndex
CREATE INDEX "Apoderado_pacienteId_idx" ON "Apoderado"("pacienteId");

-- CreateIndex
CREATE INDEX "Paquete_sedeId_idx" ON "Paquete"("sedeId");

-- CreateIndex
CREATE INDEX "Paquete_pacienteId_idx" ON "Paquete"("pacienteId");

-- CreateIndex
CREATE INDEX "Cita_sedeId_fecha_idx" ON "Cita"("sedeId", "fecha");

-- CreateIndex
CREATE INDEX "Cita_pacienteId_idx" ON "Cita"("pacienteId");

-- CreateIndex
CREATE INDEX "Cita_terapeutaId_fecha_idx" ON "Cita"("terapeutaId", "fecha");

-- CreateIndex
CREATE INDEX "Cita_paqueteId_idx" ON "Cita"("paqueteId");

-- CreateIndex
CREATE INDEX "Pago_sedeId_fechaPago_idx" ON "Pago"("sedeId", "fechaPago");

-- CreateIndex
CREATE INDEX "Pago_pacienteId_idx" ON "Pago"("pacienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_sedeId_numeroRecibo_key" ON "Pago"("sedeId", "numeroRecibo");

-- AddForeignKey
ALTER TABLE "UserSede" ADD CONSTRAINT "UserSede_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSede" ADD CONSTRAINT "UserSede_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terapeuta" ADD CONSTRAINT "Terapeuta_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apoderado" ADD CONSTRAINT "Apoderado_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_terapeutaId_fkey" FOREIGN KEY ("terapeutaId") REFERENCES "Terapeuta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "Paquete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "Paquete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
