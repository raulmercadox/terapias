# Despliegue y configuración del servidor (producción)

El sitio es **https://geniusschool.com.pe** (también responde `www`). Corre en
un VPS Hostinger (CentOS Stream 10) con app en `/opt/genius`, servida por
systemd (`genius.service`) detrás de nginx con HTTPS.

| Dato               | Valor                                          |
| ------------------ | ---------------------------------------------- |
| Dominio            | `geniusschool.com.pe`, `www.geniusschool.com.pe` |
| IPv4 / IPv6        | `2.25.162.59` / `2a02:4780:75:9ebb::1`         |
| Hostname del VPS   | `srv1724566.hstgr.cloud`                       |
| Acceso             | `ssh root@2.25.162.59`                         |

El hostname `srv1724566.hstgr.cloud` es solo el nombre que Hostinger le da a la
máquina: sirve para entrar por SSH, pero **no** para abrir el sitio. El
certificado se emitió para `geniusschool.com.pe`, así que pedir el sitio por ese
hostname falla la verificación TLS (curl corta con error 60, «SSL peer
certificate ... not OK»). Para comprobar que el sitio está sano hay que usar el
dominio real:

```bash
curl -sI https://geniusschool.com.pe/login | head -1   # HTTP/1.1 200 OK
```

## Cómo desplegar

```bash
./deploy/deploy.sh --dry-run   # muestra qué cambiaría, sin tocar nada
./deploy/deploy.sh             # despliega (pide confirmación)
```

El script sincroniza el código por `rsync`, compila **en el servidor** y
reinicia el servicio. Opciones: `--yes` (sin confirmación), `--migrate`
(aplica migraciones de Prisma), `--skip-build`, `--help`.

Destino y llave se pueden sobreescribir por entorno: `SSH_HOST`, `SSH_KEY`,
`APP_DIR`, `SERVICE`.

### Importante: `/opt/genius` no es un clon de git

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
`/opt/genius-backups/src-<timestamp>.tar.gz` (se conservan los últimos 5).
Está **fuera** de `/opt/genius` a propósito: `--delete` borraría cualquier
respaldo guardado dentro del directorio sincronizado.

Para revertir:

```bash
ssh root@2.25.162.59
cd /opt/genius
tar xzf /opt/genius-backups/src-<timestamp>.tar.gz
npm run build && systemctl restart genius
```

### Migraciones

El script **no** aplica migraciones por defecto. Si detecta cambios en
`prisma/`, regenera el cliente y avisa; para aplicarlas hay que pasar
`--migrate` explícitamente (ejecuta `prisma migrate deploy`).

## Archivos de configuración

Copia fiel de lo que corre en el VPS. No se aplican solos: hay que copiarlos a
mano.

| Archivo          | Destino en el servidor               |
| ---------------- | ------------------------------------ |
| `genius.service` | `/etc/systemd/system/genius.service` |
| `genius.conf`    | `/etc/nginx/conf.d/genius.conf`      |

Tras copiar: `systemctl daemon-reload && systemctl restart genius` y
`nginx -t && systemctl reload nginx`.

## Notas

- `genius.conf` tiene los bloques que agregó Certbot al emitir el certificado.
  El `server` de :80 termina en `return 404` y solo redirige a HTTPS cuando
  `$host` es `geniusschool.com.pe` o `www.geniusschool.com.pe`: por eso entrar
  por IP (`http://2.25.162.59`) responde **404** aunque la app esté sana. Para
  servir también por IP habría que agregarle un `return 301 https://...` o un
  bloque propio.
- `nginx.conf` base fue editado en el servidor para quitarle `default_server`
  (lo declara este archivo) — ese cambio no está versionado aquí.
- El `.env` de producción (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`) vive solo
  en el servidor y no se versiona. `AUTH_URL` es `https://geniusschool.com.pe`:
  si cambia el dominio hay que actualizarlo ahí además de en nginx y Certbot.
- macOS trae `openrsync`, no GNU rsync. No implementa `--out-format` ni
  `--itemize-changes`, y en dry-run lista todos los archivos como pendientes
  aunque estén idénticos; por eso el script detecta cambios comparando
  checksums en vez de confiar en `rsync -n`.
