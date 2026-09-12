# Terapias — Sistema para centros de terapia

Sistema web **multitenant** para centros de terapia: cada centro (empresa) tiene
sus sedes, usuarios y datos aislados de los demás. Módulos: **Pacientes,
Seguimiento, Citas/Agenda, Sesiones (paquetes), Pagos** y **Configuración**
(usuarios, sedes, terapeutas, programas, horario, feriados), multi-sede y con
control de acceso por rol.

## Stack
- **Next.js 16** (App Router, TypeScript) + **React 19**
- **PostgreSQL** con **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Auth.js v5** (credenciales, sesión JWT con rol + centro + sedes)
- **Tailwind CSS v4**

## Centros, roles y sedes
- **Centro**: la empresa. Su *código* es lo que se escribe en el campo
  **Empresa** del login; su *nombre* y *subtítulo* aparecen en la barra
  lateral, la pestaña, los recibos, los informes y los mensajes de WhatsApp.
- **Superadmin** (plataforma): da de alta y administra centros en `/plataforma`.
  Inicia sesión con la empresa reservada `plataforma`.
- **Administrador**: acceso a todas las sedes de su centro; gestiona usuarios,
  sedes, terapeutas, etc.
- **Coordinador**: acceso a las sedes que le asigne el administrador.
- **Usuario**: acceso a una sola sede.

El login pide **Empresa + Usuario + Clave**. El nombre de usuario es único dentro
de cada centro (dos centros pueden tener un usuario `admin`). El filtro por
**sede activa** (selector en la barra superior) atraviesa todos los módulos.

## Puesta en marcha (desarrollo)

Requisitos: Node 20+ (probado en 22/24) y Docker.

```bash
# 1. Base de datos (contenedor terapiasdb en el puerto 5434)
docker compose up -d

# 2. Dependencias
npm install

# 3. Variables de entorno
cp .env.example .env   # DATABASE_URL de desarrollo y un AUTH_SECRET propio

# 4. Migraciones + datos iniciales (superadmin y centro demo)
npx prisma migrate deploy
npx prisma db seed

# 5. Servidor de desarrollo
npm run dev
```

App en http://localhost:3100

**Accesos iniciales (desarrollo):**

| Empresa      | Usuario      | Clave      | Entra a                 |
| ------------ | ------------ | ---------- | ----------------------- |
| `demo`       | `admin`      | `admin123` | Centro Demo             |
| `plataforma` | `superadmin` | `admin123` | Panel de centros        |

## Comandos útiles
- `npx prisma studio` — explorar/editar la base de datos.
- `npx prisma migrate dev --name <cambio>` — nueva migración tras editar el esquema.
- `npm test` — pruebas unitarias.
- `npm run build && npm start` — build y ejecución de producción.

## Despliegue

Corre de forma nativa (systemd + nginx + PostgreSQL del sistema, sin Docker) en
el VPS compartido con `sistema_comercial` y `clinica-dental`. Montaje inicial,
despliegues y rollback en [`deploy/README.md`](deploy/README.md).

> Comprobantes: por ahora son **recibos internos** imprimibles (sin valor SUNAT).
> Recordatorios por **WhatsApp**: enlace *click-to-send* (sin costo de API).
