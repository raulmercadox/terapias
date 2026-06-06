# B-Genius — Sistema de Terapias (Aula Azul)

Sistema web para el centro psicopedagógico B-Genius. Esta primera entrega cubre la
línea **Terapias / Aula Azul** con módulos de **Pacientes, Citas/Agenda, Sesiones
(paquetes), Pagos** y **Configuración** (usuarios, sedes, terapeutas), multi-sede y
control de acceso por rol.

## Stack
- **Next.js 16** (App Router, TypeScript) + **React 19**
- **PostgreSQL** con **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Auth.js v5** (credenciales, sesión JWT con rol + sedes)
- **Tailwind CSS v4**

## Roles y sedes
- **Administrador**: acceso a todas las sedes; gestiona usuarios/sedes/terapeutas.
- **Coordinador**: acceso a las sedes que le asigne el administrador.
- **Usuario**: acceso a una sola sede.

El filtro por **sede activa** (selector en la barra superior) atraviesa todos los módulos.

## Puesta en marcha (desarrollo)

Requisitos: Node 20+ (probado en 24) y Docker (o un PostgreSQL propio).

```bash
# 1. Base de datos
docker compose up -d

# 2. Dependencias
npm install

# 3. Variables de entorno
cp .env.example .env   # ajusta DATABASE_URL y AUTH_SECRET si hace falta

# 4. Migraciones + datos iniciales (sedes, admin, terapeutas demo)
npx prisma migrate dev
npx prisma db seed

# 5. Servidor de desarrollo
npm run dev
```

App en http://localhost:3000

**Usuario inicial:** `admin@bgenius.pe` / `admin123` (cámbialo en Configuración).

## Comandos útiles
- `npx prisma studio` — explorar/editar la base de datos.
- `npx prisma migrate dev --name <cambio>` — nueva migración tras editar el esquema.
- `npm run build && npm start` — build y ejecución de producción.

## Despliegue (VPS CentOS, resumen)
1. Instalar Node LTS y PostgreSQL (o usar contenedor).
2. Definir `.env` con `DATABASE_URL` y un `AUTH_SECRET` fuerte (`openssl rand -base64 32`).
3. `npm ci && npx prisma migrate deploy && npm run build`.
4. Ejecutar con un gestor de procesos (pm2/systemd): `npm start` (puerto 3000).
5. Nginx como reverse proxy con HTTPS hacia el puerto 3000.

> Comprobantes: por ahora son **recibos internos** imprimibles (sin valor SUNAT).
> Recordatorios por **WhatsApp**: enlace *click-to-send* (sin costo de API).
