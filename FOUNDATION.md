# Contrato de la base (léelo antes de codificar tu módulo)

Sistema B-Genius — línea **Terapias / Aula Azul**. App Next.js en `web/`.
**Versiones (¡distintas a tu entrenamiento!):** Next.js 16, React 19, Prisma 7, Auth.js v5 (next-auth beta), Tailwind v4.

## Reglas de oro Next 16
- `params` y `searchParams` que llegan a `page.tsx`/`layout.tsx` son **Promises**: `const { id } = await params`.
- `cookies()` de `next/headers` es **async**: `const c = await cookies()`.
- Mutaciones = **Server Actions** (`"use server"`). Tras mutar: `revalidatePath(...)` y/o `redirect(...)` de `next/navigation`.
- Componentes con estado/eventos (`useState`, `onClick`, `onChange`, `useActionState`) llevan `"use client"`.
- Tipado opcional de props de página: `PageProps<'/ruta'>`.

## NO TOQUES estos archivos (ya están listos y son compartidos)
`prisma/schema.prisma`, `src/lib/*`, `src/components/ui.tsx`, `src/components/sidebar.tsx`, `src/components/sede-switcher.tsx`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/actions.ts`, `src/proxy.ts`, `src/app/login/*`.
Trabaja **solo dentro de la carpeta de tu módulo**. Si crees que falta un campo en el esquema, NO lo edites: usa los campos existentes y déjalo anotado en tu resumen final.

## NO ejecutes
- No corras `npm run dev` ni `next build` (otro proceso/los demás agentes están activos). No corras `tsc` global. Valida leyendo el código y siguiendo este contrato; la integración la verifico yo al final.

## Cliente Prisma
```ts
import { prisma } from "@/lib/prisma";
```
Enums y tipos: `import type { Rol, EstadoCita, Asistencia, ... } from "@prisma/client";`
Los montos `Decimal` se formatean con `soles()`; al crear pásalos como `number` o string.

## Sesión y alcance por sede (`@/lib/session`)
```ts
import {
  requireUser,          // -> SessionUser {id,nombre,email,rol,sedeIds}; redirige a /login si no hay
  requireActiveSede,    // (user) -> Promise<string> sedeId activo; redirige a /sin-sede si no tiene
  getSedesForUser,      // (user) -> Promise<Sede[]> (admin = todas)
  canAccessSede,        // (user, sedeId) -> boolean
  assertSedeAccess,     // (user, sedeId) -> lanza si no tiene acceso (úsalo en server actions)
} from "@/lib/session";
```
**Patrón de toda página de módulo:**
```ts
const user = await requireUser();
const sedeId = await requireActiveSede(user);
// consulta SIEMPRE filtrando por sedeId:
const data = await prisma.paciente.findMany({ where: { sedeId, /* ... */ } });
```
**Patrón de toda server action que crea/edita:** obtener `user`, validar con `assertSedeAccess(user, sedeId)` antes de escribir.

## UI compartida (`@/components/ui`)
`PageHeader{title,subtitle?,actions?}`, `Card`, `EmptyState{message}`, `Button{variant:primary|secondary|danger|ghost}`, `ButtonLink{href,variant}`, `Field{label,required?}`, `Input`, `Textarea`, `Select`, `Table`/`Th`/`Td`, `Badge{color:green|red|amber|sky|slate}`.
Helpers (`@/lib/utils`): `cn`, `soles(x)`, `fecha(d)`, `edad(fechaNac)`, `nombreCompleto({nombres,apellidoPaterno,apellidoMaterno})`.
Para impresión: envuelve lo imprimible en `<div className="print-area">` y oculta botones con `className="no-print"` (CSS ya definido en globals.css).

## Modelo de datos (resumen; ver schema.prisma para el detalle)
- **Sede**(id,nombre,...). **Terapeuta**(id,sedeId,nombres,apellidos,especialidad). 
- **Paciente**(id,sedeId,nombres,apellidoPaterno,apellidoMaterno,dni,fechaNacimiento,sexo,telefono,correo,direccion,distrito,fotoUrl,programa,diagnostico,estado,observaciones) 1—n **Apoderado**(pacienteId,nombres,apellidos,dni,telefono,correo,vinculo,principal).
- **Paquete**(id,sedeId,pacienteId,totalSesiones,frecuenciaSemana,precio,fechaInicio,fechaFin,estado) 1—n **Cita**.
- **Cita**(id,sedeId,pacienteId,terapeutaId?,paqueteId?,numeroSesion?,fecha,horaInicio:"09:00",horaFin,tipo,estado,asistencia,terapiaRealizada?,observacion?,recordatorioEnviado).
- **Pago**(id,sedeId,pacienteId,paqueteId?,numeroRecibo,concepto,descripcion?,monto,saldo,metodoPago,referencia?,fechaPago). Único: `@@unique([sedeId, numeroRecibo])`.

Enums: `Rol`, `Sexo(M,F)`, `EstadoPaciente(ACTIVO,BAJA)`, `Programa(ESCOLAR,INTERDIARIO,TERAPIAS)`, `Vinculo(MADRE,PADRE,APODERADO,OTRO)`, `TipoCita(CONSULTA,EVALUACION,SESION)`, `EstadoCita(AGENDADA,ATENDIDA,CANCELADA)`, `Asistencia(PENDIENTE,ASISTIO,FALTO,TARDANZA)`, `EstadoPaquete(ACTIVO,COMPLETADO,VENCIDO,ANULADO)`, `ConceptoPago(MATRICULA,MATERIALES,MENSUALIDAD,PAQUETE_SESIONES,EVALUACION,OTRO)`, `MetodoPago(EFECTIVO,YAPE,PLIN,TRANSFERENCIA,TARJETA)`.

La navegación lateral ya enlaza a `/pacientes`, `/citas`, `/sesiones`, `/pagos`, `/configuracion`. Crea tu `page.tsx` raíz en esa ruta.
