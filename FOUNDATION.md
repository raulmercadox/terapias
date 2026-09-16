# Contrato de la base (léelo antes de codificar tu módulo)

Sistema **Terapias** — multitenant para centros de terapia.
**Versiones (¡distintas a tu entrenamiento!):** Next.js 16, React 19, Prisma 7, Auth.js v5 (next-auth beta), Tailwind v4.

## Reglas de oro Next 16
- `params` y `searchParams` que llegan a `page.tsx`/`layout.tsx` son **Promises**: `const { id } = await params`.
- `cookies()` de `next/headers` es **async**: `const c = await cookies()`.
- Mutaciones = **Server Actions** (`"use server"`). Tras mutar: `revalidatePath(...)` y/o `redirect(...)` de `next/navigation`.
- Un archivo `"use server"` solo puede exportar funciones async (y tipos). Las constantes compartidas van en otro archivo.
- Componentes con estado/eventos (`useState`, `onClick`, `onChange`, `useActionState`) llevan `"use client"`.
- Tipado opcional de props de página: `PageProps<'/ruta'>`.
- `src/proxy.ts` (antes `middleware`) solo hace chequeos optimistas; la autorización real va en páginas y acciones.

## Archivos compartidos (cámbialos solo si tu tarea es de la base)
`prisma/schema.prisma`, `src/lib/*`, `src/components/ui.tsx`, `src/components/sidebar.tsx`, `src/components/sede-switcher.tsx`, `src/components/ficha/*`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/actions.ts`, `src/proxy.ts`, `src/app/login/*`, `src/app/plataforma/*`.

## Multitenancy: cómo se aísla cada centro
- **Centro**(id,codigo,nombre,subtitulo,activo) 1—n **Sede** y 1—n **User**.
- Todo lo demás (pacientes, citas, pagos…) cuelga de `sedeId`. **No hay `centroId` en esas tablas**: el aislamiento consiste en validar que la sede pertenece al centro del usuario.
- Por eso: **nunca** leas o escribas un registro por `id` sin comprobar después su `sedeId` con `canAccessSede`/`assertSedeAccess`, o sin filtrar por `sedeId` / `sede: { centroId }` en el `where`.
- Las consultas directas a `sede` o `user` filtran siempre por `centroId: user.centroId`.
- Excepción: **Configuracion** (cobranza) sí cuelga del centro, una fila por centro y vale para todas sus sedes. Se lee con `obtenerConfiguracion(user.centroId)` (`@/lib/configuracion`).
- Igual **PlantillaFicha**: la estructura de las fichas clínicas es propia de cada centro (ver abajo).

## Sesión y alcance (`@/lib/session`)
```ts
import {
  requireUser,          // -> SessionUser {id,nombre,usuario,rol,centroId,sedeIds}; redirige a /login (y al superadmin a /plataforma)
  requireSuperadmin,    // solo para /plataforma
  getCentro,            // (centroId) -> {nombre,subtitulo,codigo,...} marca del centro (memoizado por request)
  requireActiveSede,    // (user) -> Promise<string> sedeId activo; redirige a /sin-sede si no tiene
  getSedesForUser,      // (user) -> Promise<Sede[]> (admin = todas las de su centro)
  canAccessSede,        // (user, sedeId) -> Promise<boolean>   ¡ASYNC: usa await!
  assertSedeAccess,     // (user, sedeId) -> Promise<void>, lanza si no tiene acceso  ¡ASYNC!
} from "@/lib/session";
```
**Patrón de toda página de módulo:**
```ts
const user = await requireUser();
const sedeId = await requireActiveSede(user);
// consulta SIEMPRE filtrando por sedeId:
const data = await prisma.paciente.findMany({ where: { sedeId, /* ... */ } });
```
**Página de detalle por id:** `if (!registro || !(await canAccessSede(user, registro.sedeId))) notFound();`
**Server action que crea/edita:** obtener `user` y `await assertSedeAccess(user, sedeId)` antes de escribir.
**Nombre del centro en pantalla:** `const centro = await getCentro(user.centroId)` → `centro.nombre`, `centro.subtitulo`. Nunca escribas una marca fija.

## Cliente Prisma
```ts
import { prisma } from "@/lib/prisma";
```
Enums y tipos: `import type { Rol, EstadoCita, Asistencia, ... } from "@prisma/client";`
Los montos `Decimal` se formatean con `soles()`; al crear pásalos como `number` o string.

## UI compartida (`@/components/ui`)
`PageHeader{title,subtitle?,actions?}`, `Card`, `EmptyState{message}`, `Button{variant:primary|secondary|danger|ghost}`, `ButtonLink{href,variant}`, `Field{label,required?}`, `Input`, `Textarea`, `Select`, `Table`/`Th`/`Td`, `Badge{color:green|red|amber|sky|slate}`.
Formularios: `useFormReintento` (`@/components/form-reintento`) conserva lo escrito cuando la acción devuelve error.
Helpers (`@/lib/utils`): `cn`, `soles(x)`, `fecha(d)`, `edad(fechaNac)`, `nombreCompleto({nombres,apellidoPaterno,apellidoMaterno})`, `iniciales(nombre)`.
Para impresión: envuelve lo imprimible en `<div className="print-area">` y oculta botones con `className="no-print"` (CSS ya definido en globals.css).

## Fichas clínicas: la estructura la pone el centro, no el código
La historia clínica, la ficha de evaluación y el informe de avance **no tienen columnas por campo**: su estructura es una plantilla editable por centro, y eso es lo que permite que el sistema sirva a terapia psicológica y a terapia física con el mismo código.

```ts
import { obtenerPlantilla } from "@/lib/plantillas";        // (centroId, tipo) -> plantilla vigente, memoizada
import { normalizarValores } from "@/lib/fichas/valores";   // sanea lo guardado contra la plantilla
import { FichaForm } from "@/components/ficha/ficha-form";  // formulario genérico
import { FichaVista } from "@/components/ficha/ficha-vista";// vista y formato impreso
```
- Tipos de campo (`@/lib/fichas/tipos`): `texto`, `parrafo`, `casilla`, `opciones`, `tabla` y `checklist` con escala configurable. Un grupo puede mostrarse solo bajo condición (`visibleSi`).
- **Historia clínica**: expediente vivo, sigue la plantilla **vigente** del centro.
- **Evaluación e informe**: **congelan** la plantilla con la que se aplicaron (`estructura`), porque son instrumentos fechados y firmados; se actualizan solo si el profesional lo pide (`reconciliar`, `@/lib/fichas/snapshot`).
- Lo registrado con campos que luego se quitan de la plantilla **nunca se borra**: queda como huérfano y se muestra aparte.
- Los ids de campo e ítem son **estables e inmutables**: la analítica de progreso compara los informes por id. `src/lib/fichas/base/base.test.ts` lo protege.
- Plantillas base prearmadas en `@/lib/fichas/base` (`psicologica`, `fisica`); se eligen al dar de alta el centro.

## Modelo de datos (resumen; ver schema.prisma para el detalle)
- **Centro**(id,codigo,nombre,subtitulo,activo). **Sede**(id,centroId,nombre,…), `@@unique([centroId, nombre])`.
- **Configuracion**(centroId @id,graciaTipo,graciaValor,diasAvisoCobro): plazo de pago de los paquetes del centro. Se edita en Configuración › Cobranza y la usa /pagos/cobranza.
- **PlantillaFicha**(centroId,tipo,base,version,secciones Json), `@@unique([centroId, tipo])`: estructura de cada ficha clínica del centro.
- **HistoriaClinica**(id,sedeId,pacienteId @unique,fecha,valores Json). **Evaluacion**(id,sedeId,pacienteId,evaluadorId?,fecha,estructura Json,valores Json,plantillaVersion,programaRecomendado?,recomendaciones?). **InformeAvance**(id,sedeId,pacienteId,evaluadorId?,fecha,secciones Json,recomendaciones?).
- **User**(id,centroId?,nombre,usuario,email?,rol,activo), `@@unique([centroId, usuario])`. `centroId` es null solo para SUPERADMIN.
- **Terapeuta**(id,sedeId,nombres,apellidos,especialidad).
- **Paciente**(id,sedeId,nombres,apellidoPaterno,apellidoMaterno,dni,fechaNacimiento,sexo,telefono,correo,direccion,distrito,fotoUrl,programa,diagnostico,estado,observaciones) 1—n **Apoderado**(pacienteId,nombres,apellidos,dni,telefono,correo,vinculo,principal).
- **Paquete**(id,sedeId,pacienteId,totalSesiones,frecuenciaSemana,precio,fechaInicio,fechaFin,estado) 1—n **Cita**.
- **Cita**(id,sedeId,pacienteId,terapeutaId?,paqueteId?,numeroSesion?,fecha,horaInicio:"09:00",horaFin,tipo,estado,asistencia,terapiaRealizada?,observacion?,recordatorioEnviado).
- **Pago**(id,sedeId,pacienteId,paqueteId?,numeroRecibo,concepto,descripcion?,monto,saldo,metodoPago,referencia?,fechaPago). Único: `@@unique([sedeId, numeroRecibo])`.

Enums: `Rol(SUPERADMIN,ADMINISTRADOR,COORDINADOR,USUARIO)`, `Sexo(M,F)`, `EstadoPaciente(ACTIVO,BAJA)`, `Programa(ESCOLAR,INTERDIARIO,TERAPIAS)`, `Vinculo(MADRE,PADRE,APODERADO,OTRO)`, `TipoCita(CONSULTA,EVALUACION,SESION)`, `EstadoCita(AGENDADA,ATENDIDA,CANCELADA)`, `Asistencia(PENDIENTE,ASISTIO,FALTO,TARDANZA)`, `EstadoPaquete(ACTIVO,COMPLETADO,VENCIDO,ANULADO)`, `ConceptoPago(MATRICULA,MATERIALES,MENSUALIDAD,PAQUETE_SESIONES,EVALUACION,OTRO)`, `MetodoPago(EFECTIVO,YAPE,PLIN,TRANSFERENCIA,TARJETA)`, `TipoGracia(PORCENTAJE,DIAS)`, `TipoFicha(HISTORIA,EVALUACION,INFORME)`.
