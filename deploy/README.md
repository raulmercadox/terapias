# Configuración del servidor (producción)

Copia fiel de lo que corre en el VPS (CentOS Stream 10, app en `/opt/genius`).
Sirve para reconstruir el servidor o revisar cambios de infraestructura en el
historial, no se aplica solo: hay que copiar los archivos a mano.

| Archivo          | Destino en el servidor              |
| ---------------- | ----------------------------------- |
| `genius.service` | `/etc/systemd/system/genius.service` |
| `genius.conf`    | `/etc/nginx/conf.d/genius.conf`      |

Tras copiar: `systemctl daemon-reload && systemctl restart genius` y
`nginx -t && systemctl reload nginx`.

## Notas

- `genius.conf` tiene los bloques que agregó Certbot al emitir el certificado.
  El `server` de :80 termina en `return 404` y solo redirige a HTTPS los dos
  `$host` del dominio: por eso entrar por IP (`http://2.25.162.59`) responde
  **404** aunque la app esté sana. Para servir también por IP habría que
  agregarle un `return 301 https://...` o un bloque propio.
- `nginx.conf` base fue editado en el servidor para quitarle `default_server`
  (lo declara este archivo) — ese cambio no está versionado aquí.
- El `.env` de producción (DATABASE_URL, AUTH_SECRET, AUTH_URL) vive solo en el
  servidor y no se versiona. El tar de despliegue lo excluye para no pisarlo.
