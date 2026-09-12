# Despliegue y configuración del servidor (producción)

Terapias corre en el **VPS compartido** con `sistema_comercial` y
`clinica-dental` (CentOS Stream 9). Allí **no hay Docker**: nginx y PostgreSQL
están instalados directamente en el sistema. La app vive en `/opt/terapias`,
servida por systemd (`terapias.service`) en `127.0.0.1:3100`, detrás de nginx
con HTTPS.

| Dato               | Valor                                              |
| ------------------ | -------------------------------------------------- |
| Dominio            | `terapias.codart.pe` (registro A → `85.31.224.231`) |
| IPv4 / hostname    | `85.31.224.231` / `srv634696.hstgr.cloud`          |
| Acceso             | `ssh -i ~/.ssh/vps_terapias root@85.31.224.231`     |
| Directorio         | `/opt/terapias`                                    |
| Servicio / puerto  | `terapias.service` / `127.0.0.1:3100`              |
| Base de datos      | PostgreSQL del sistema, base y rol `terapias`      |

Estado del VPS (revisado el 2026-09-12): CentOS Stream 9, Node 20.20,
PostgreSQL 16 (servicio `postgresql-16`, en `127.0.0.1:5432`), nginx 1.20 y
Certbot 3.1. Los puertos 3000 y 3001 ya están ocupados por las otras apps; el
3100 está libre. En `conf.d` ya existen `sistema-comercial.conf` (`codart.pe`,
`www.codart.pe`) y `clinica-dental.conf` (`dental.codart.pe`). Antes de cada
cambio de puerto confirma con `ss -tlnp | grep 3100`.

## Montaje inicial (una sola vez)

```bash
ssh root@<IP-del-VPS>

# 1. Base de datos en el PostgreSQL del sistema
sudo -u postgres createuser --pwprompt terapias
sudo -u postgres createdb -O terapias terapias

# 2. Directorio y variables de entorno
mkdir -p /opt/terapias
cat > /opt/terapias/.env <<'EOF'
DATABASE_URL="postgresql://terapias:<CLAVE>@localhost:5432/terapias?schema=public"
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="https://terapias.codart.pe"
AUTH_TRUST_HOST="true"
EOF
chmod 600 /opt/terapias/.env
```

Usa un `AUTH_SECRET` **propio**, distinto al de las otras apps: si se comparte,
una sesión de un sistema sería válida en el otro.

Desde tu máquina, la primera sincronización (el script exige que ya existan
`/opt/terapias` y su `.env`):

```bash
SSH_HOST=root@<IP-del-VPS> ./deploy/deploy.sh --migrate --yes
```

El primer build falla al reiniciar si el servicio aún no está instalado; es
esperado. Luego, en el servidor:

```bash
cd /opt/terapias
npm ci
npx prisma migrate deploy
NODE_ENV=production SEED_SUPERADMIN_PASSWORD='<clave-fuerte>' npx prisma db seed
npm run build

# systemd
cp deploy/terapias.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now terapias

# nginx + HTTPS
cp deploy/terapias.conf /etc/nginx/conf.d/terapias.conf
nginx -t && systemctl reload nginx
certbot --nginx -d terapias.codart.pe
```

En producción el seed **solo** crea el superadmin (empresa `plataforma`, usuario
`superadmin`); el centro demo no se crea. Los centros reales se dan de alta
desde `/plataforma`.

## Cómo desplegar

```bash
SSH_HOST=root@<IP-del-VPS> ./deploy/deploy.sh --dry-run   # muestra qué cambiaría
SSH_HOST=root@<IP-del-VPS> ./deploy/deploy.sh             # despliega (pide confirmación)
```

El script sincroniza el código por `rsync`, compila **en el servidor** y
reinicia el servicio. Opciones: `--yes` (sin confirmación), `--migrate`
(aplica migraciones de Prisma), `--skip-build`, `--help`.

`SSH_HOST` es obligatorio y **no tiene valor por defecto** a propósito: este
repo nació como copia de otro proyecto, y desplegar en el VPS equivocado lo
pisaría. También se pueden sobreescribir `SSH_KEY`, `APP_DIR` y `SERVICE`.

### Importante: `/opt/terapias` no es un clon de git

No hay `.git` en el servidor, así que **`git pull` allá no funciona**. El
código llega por rsync desde una copia local del repo; lo que se despliega es
tu working tree, no una rama remota. Por eso el script avisa si tienes cambios
sin commitear.

Qué queda fuera de la sincronización (y por qué):

| Excluido               | Motivo                                            |
| ---------------------- | ------------------------------------------------- |
| `.env`                 | Los secretos de producción viven solo ahí         |
| `node_modules/`        | Se instala en el servidor (`npm ci`)              |
| `.next/`               | Se regenera en cada build                         |
| `.git/`, `.claude/`    | No hacen falta en producción                      |

`rsync --delete` mantiene el servidor en espejo del repo, así que un archivo
borrado localmente también desaparece allá. Las exclusiones de arriba lo
protegen de borrar `.env` o `node_modules`.

### Respaldos y rollback

Antes de cada despliegue se guarda un tar del código fuente en
`/opt/terapias-backups/src-<timestamp>.tar.gz` (se conservan los últimos 5).
Está **fuera** de `/opt/terapias` a propósito: `--delete` borraría cualquier
respaldo guardado dentro del directorio sincronizado.

Para revertir:

```bash
ssh root@<IP-del-VPS>
cd /opt/terapias
tar xzf /opt/terapias-backups/src-<timestamp>.tar.gz
npm run build && systemctl restart terapias
```

### Migraciones

El script **no** aplica migraciones por defecto. Si detecta cambios en
`prisma/`, regenera el cliente y avisa; para aplicarlas hay que pasar
`--migrate` explícitamente (ejecuta `prisma migrate deploy`).

## Archivos de configuración

Copia fiel de lo que corre en el VPS (montado el 2026-09-12). No se aplican
solas: hay que copiarlas a mano.

`terapias.conf` ya incluye los bloques que agregó Certbot (443 y redirección
de HTTP a HTTPS). Si algún día se monta el servidor desde cero, primero hay que
quitar esos bloques (las líneas `# managed by Certbot` y el segundo `server`) y
dejar `listen 80;` en el primero: si no, `nginx -t` falla porque el certificado
aún no existe. Certbot los vuelve a agregar al emitirlo.

| Archivo            | Destino en el servidor                 |
| ------------------ | -------------------------------------- |
| `terapias.service` | `/etc/systemd/system/terapias.service` |
| `terapias.conf`    | `/etc/nginx/conf.d/terapias.conf`      |

Tras copiar: `systemctl daemon-reload && systemctl restart terapias` y
`nginx -t && systemctl reload nginx`.

## Notas

- `terapias.conf` **no** declara `default_server` ni `server_name _`: en un VPS
  con varias apps, eso le robaría el tráfico a las demás. Solo responde a su
  dominio. Certbot le agrega el bloque 443 y la redirección a HTTPS.
- `AUTH_URL` del `.env` debe coincidir con el dominio: si cambia, hay que
  actualizarlo ahí además de en nginx y Certbot.
- macOS trae `openrsync`, no GNU rsync. No implementa `--out-format` ni
  `--itemize-changes`, y en dry-run lista todos los archivos como pendientes
  aunque estén idénticos; por eso el script detecta cambios comparando
  checksums en vez de confiar en `rsync -n`.
