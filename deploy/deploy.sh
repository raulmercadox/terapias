#!/usr/bin/env bash
#
# Despliegue de Terapias al VPS.
#
#   SSH_HOST=root@<IP-del-VPS> ./deploy/deploy.sh [--dry-run] [--yes] [--migrate] [--skip-build]
#
# El servidor NO es un clon de git: se sincroniza el código fuente por rsync y
# el build se hace allá. Ver deploy/README.md.
set -euo pipefail

# Sin valor por defecto a propósito: este repo nació como copia de otro
# proyecto y desplegar en el VPS equivocado lo pisaría.
SSH_HOST="${SSH_HOST:-}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/vps_terapias}"
APP_DIR="${APP_DIR:-/opt/terapias}"
BACKUP_DIR="${BACKUP_DIR:-/opt/terapias-backups}"
SERVICE="${SERVICE:-terapias}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3100/login}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"

DRY_RUN=0 ASSUME_YES=0 RUN_MIGRATE=0 SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)    DRY_RUN=1 ;;
    --yes|-y)     ASSUME_YES=1 ;;
    --migrate)    RUN_MIGRATE=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opción desconocida: $arg" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 "$SSH_HOST")
say()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[aviso]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

[ -n "$SSH_HOST" ] || die "define SSH_HOST (p. ej. SSH_HOST=root@<IP-del-VPS> $0)"

# Todo lo que NO se sube. .env y node_modules viven solo en el servidor;
# .next se regenera allá. Sin estas exclusiones, --delete los borraría.
EXCLUDES=(
  --exclude '.git/'
  --exclude '.claude/'
  --exclude 'node_modules/'
  --exclude '.next/'
  --exclude '.env'
  --exclude 'tsconfig.tsbuildinfo'
  --exclude '.DS_Store'
)

# ---------------------------------------------------------------- preflight
say "Verificando entorno"
command -v rsync >/dev/null || die "rsync no está instalado localmente"
[ -f "$SSH_KEY" ] || die "no existe la llave SSH: $SSH_KEY"
"${SSH[@]}" true 2>/dev/null || die "no hay acceso SSH a $SSH_HOST con $SSH_KEY"

"${SSH[@]}" "[ -d '$APP_DIR' ]" || die "$APP_DIR no existe en el servidor"
"${SSH[@]}" "[ -f '$APP_DIR/.env' ]" \
  || die "$APP_DIR/.env no existe en el servidor; la app no arrancaría"

if [ -n "$(git status --porcelain)" ]; then
  warn "El working tree tiene cambios sin commitear; se desplegará tal cual está."
fi
echo "  local:    $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
echo "  destino:  $SSH_HOST:$APP_DIR"

# Qué cambiaría, antes de tocar nada.
#
# No se usa `rsync -n` para esto: el openrsync que trae macOS no implementa
# --out-format ni --itemize-changes como GNU rsync, y lista TODOS los archivos
# como pendientes aunque sean idénticos. Comparar checksums es equivalente y
# funciona igual con cualquier implementación.
say "Comparando con el servidor"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git ls-files -z --cached --others --exclude-standard > "$TMP/lista"
# `|| true` en ambos lados: md5sum sale con 1 si algún archivo no existe
# (normal, son los que faltan por subir) y pipefail abortaría el script.
{ xargs -0 -r md5sum < "$TMP/lista" || true; } | sort -k2 > "$TMP/local"
"${SSH[@]}" "cd '$APP_DIR' && { xargs -0 -r md5sum 2>/dev/null || true; }" \
  < "$TMP/lista" | sort -k2 > "$TMP/remoto"

# Archivos cuyo hash difiere o que no existen en el servidor.
CAMBIOS="$(join -j2 -v1 "$TMP/local" "$TMP/remoto" | awk '{print $1}';
           join -j2 "$TMP/local" "$TMP/remoto" \
             | awk '$2 != $3 {print $1}')"
CAMBIOS="$(printf '%s\n' "$CAMBIOS" | grep -v '^$' | sort -u || true)"

if [ -z "$CAMBIOS" ]; then
  echo "  (ninguno: el servidor ya está sincronizado)"
else
  echo "$CAMBIOS" | sed 's/^/  M /'
fi

if [ "$DRY_RUN" -eq 1 ]; then
  say "--dry-run: no se modificó nada"
  exit 0
fi

if [ "$ASSUME_YES" -eq 0 ]; then
  printf '\n\033[1;33mEsto reinicia el servicio en producción (unos segundos de 502).\033[0m\n'
  read -r -p "¿Continuar? [s/N] " respuesta
  [[ "$respuesta" =~ ^[sSyY]$ ]] || die "cancelado por el usuario"
fi

# ----------------------------------------------------------------- respaldo
# Fuera de APP_DIR a propósito: rsync --delete borraría cualquier respaldo
# que quedara dentro del directorio sincronizado.
say "Respaldando código fuente actual"
STAMP="$(date +%Y%m%d-%H%M%S)"
"${SSH[@]}" "set -e
  if [ ! -d '$APP_DIR/src' ]; then
    echo '  (primer despliegue: no hay código previo que respaldar)'
    exit 0
  fi
  mkdir -p '$BACKUP_DIR'
  tar czf '$BACKUP_DIR/src-$STAMP.tar.gz' -C '$APP_DIR' \
    src prisma package.json package-lock.json next.config.ts 2>/dev/null
  ls -1t '$BACKUP_DIR'/src-*.tar.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm --
  echo \"  $BACKUP_DIR/src-$STAMP.tar.gz (\$(du -h '$BACKUP_DIR/src-$STAMP.tar.gz' | cut -f1))\""

# --------------------------------------------------------------- sincronizar
say "Sincronizando código"
rsync -az --delete "${EXCLUDES[@]}" \
  -e "ssh -i $SSH_KEY -o BatchMode=yes" ./ "$SSH_HOST:$APP_DIR/"
echo "  ok"

# ------------------------------------------------------------------- build
DEPS_CAMBIARON=0
grep -q 'package-lock.json' <<<"$CAMBIOS" && DEPS_CAMBIARON=1
SCHEMA_CAMBIO=0
grep -qE 'prisma/(schema.prisma|migrations/)' <<<"$CAMBIOS" && SCHEMA_CAMBIO=1

if [ "$DEPS_CAMBIARON" -eq 1 ]; then
  say "package-lock.json cambió: npm ci"
  "${SSH[@]}" "cd '$APP_DIR' && npm ci 2>&1 | tail -5"
fi

if [ "$SCHEMA_CAMBIO" -eq 1 ]; then
  say "El esquema de Prisma cambió: regenerando cliente"
  "${SSH[@]}" "cd '$APP_DIR' && npx prisma generate 2>&1 | tail -3"

  if [ "$RUN_MIGRATE" -eq 1 ]; then
    say "Aplicando migraciones (--migrate)"
    "${SSH[@]}" "cd '$APP_DIR' && npx prisma migrate deploy 2>&1 | tail -10"
  else
    warn "Hay cambios en prisma/ pero NO se aplicaron migraciones."
    warn "Si hacen falta, vuelve a correr con --migrate (revisa el impacto antes)."
  fi
fi

if [ "$SKIP_BUILD" -eq 0 ]; then
  say "Compilando en el servidor"
  "${SSH[@]}" "cd '$APP_DIR' && npm run build 2>&1 | tail -5" \
    || die "el build falló; NO se reinició el servicio, la app sigue con el build anterior"
fi

# ----------------------------------------------------------------- reinicio
say "Reiniciando $SERVICE"
"${SSH[@]}" "systemctl restart '$SERVICE'"

say "Comprobando salud"
OK=0
for i in $(seq 1 10); do
  CODIGO="$("${SSH[@]}" "curl -s -o /dev/null -w '%{http_code}' '$HEALTH_URL'" || echo 000)"
  if [ "$CODIGO" = "200" ]; then
    echo "  $HEALTH_URL -> 200 (intento $i)"
    OK=1
    break
  fi
  sleep 2
done

if [ "$OK" -eq 0 ]; then
  "${SSH[@]}" "journalctl -u '$SERVICE' -n 20 --no-pager" || true
  cat <<EOF

[error] La app no respondió 200 tras el reinicio.

Para revertir al código anterior:
  ssh $SSH_HOST
  cd $APP_DIR
  tar xzf $BACKUP_DIR/src-$STAMP.tar.gz
  npm run build && systemctl restart $SERVICE
EOF
  exit 1
fi

say "Despliegue completado"
echo "  revisión desplegada: $(git rev-parse --short HEAD)"
RESPALDO="$("${SSH[@]}" "[ -f '$BACKUP_DIR/src-$STAMP.tar.gz' ] && echo '$BACKUP_DIR/src-$STAMP.tar.gz' || echo '(ninguno: primer despliegue)'")"
echo "  respaldo:            $RESPALDO"
