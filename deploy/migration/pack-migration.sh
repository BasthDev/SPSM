#!/bin/bash
# pack-migration.sh — Bundle SELURUH SPSM (runtime + source + data + tunnel)
# menjadi satu file tar.gz yang bisa di-extract & restore di server baru.
#
# Pemakaian (di server LAMA, butuh sudo untuk cloudflared credentials):
#   sudo bash pack-migration.sh
#
# Hasil: /home/basth/spsm-migration-<tanggal>.tar.gz
set -euo pipefail

APP_DIR="/home/basth/spsm-app"       # git repo (source)
ROOT_DIR="/home/basth/spsm-root"     # runtime compose + data
CF_DIR="/etc/cloudflared"
OUT_DIR="/home/basth"
STAMP=$(date +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
PACK="$OUT_DIR/spsm-migration-$STAMP"

mkdir -p "$WORK/spsm-migration"
cd "$WORK/spsm-migration"

echo "[1/6] Menyalin runtime (spsm-root)..."
# Stop PocketBase sebentar supaya pb_data (SQLite) ter-copy konsisten.
# Downtime hanya beberapa detik selama penyalinan folder pb_data.
mkdir -p spsm-root
PB_STOPPED=0
if docker ps --format '{{.Names}}' | grep -qx 'pocketbase'; then
  echo "  stop container pocketbase sementara (demi backup DB konsisten)..."
  (cd "$ROOT_DIR" && docker compose stop pocketbase) >/dev/null 2>&1 && PB_STOPPED=1
fi
cp -a "$ROOT_DIR/." spsm-root/
[ "$PB_STOPPED" = "1" ] && (cd "$ROOT_DIR" && docker compose start pocketbase) >/dev/null 2>&1 && echo "  pocketbase distart kembali."
# buang archive lama & log besar bila ada
rm -rf spsm-root/archive

echo "[2/6] Menyalin source code (spsm-app, tanpa node_modules)..."
mkdir -p spsm-app
cd "$APP_DIR"
tar --exclude='./node_modules' \
    --exclude='./web_dash/node_modules' \
    --exclude='./web-deprecated/node_modules' \
    --exclude='./web_app-deprecated/node_modules' \
    --exclude='./server/node_modules' \
    --exclude='./android/.gradle' \
    --exclude='./android/app/build' \
    --exclude='./android/build' \
    --exclude='./.expo' \
    -cf - . | tar -xf - -C "$WORK/spsm-migration/spsm-app"
cd "$WORK/spsm-migration"

echo "[3/6] Menyalin cloudflared tunnel config + credentials..."
mkdir -p cloudflared
if [ -d "$CF_DIR" ]; then
  cp -a "$CF_DIR/." cloudflared/ 2>/dev/null || true
fi
# cert.pem hanya untuk manajemen tunnel (opsional, untuk create tunnel baru)
if [ -f /home/basth/.cloudflared/cert.pem ]; then
  mkdir -p cloudflared-home
  cp -a /home/basth/.cloudflared/cert.pem cloudflared-home/ 2>/dev/null || true
fi

echo "[4/6] Menyalin crontab auto-deploy..."
crontab -l 2>/dev/null | grep -v '^#' > crontab.txt || true

echo "[5/6] Menulis manifest..."
COMMIT=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo 'unknown')
cat > manifest.txt <<EOF
SPSM Migration Pack
====================
Created : $(date -Is)
Commit  : $COMMIT
Host    : $(hostname)

Isi pack:
  spsm-root/    -> /home/basth/spsm-root   (docker-compose, backend, pb_data, web dist)
  spsm-app/     -> /home/basth/spsm-app    (source + .git untuk auto-deploy)
  cloudflared/  -> /etc/cloudflared        (config.yml + tunnel credentials)
  cloudflared-home/cert.pem -> ~/.cloudflared/cert.pem (opsional)
  crontab.txt   -> crontab user 'basth'
  restore.sh    -> jalankan SETELAH extract: sudo bash restore.sh
EOF

# restore.sh + panduan ikut di dalam pack
cp "$(dirname "$0")/restore-migration.sh" restore.sh 2>/dev/null || true
cp "$(dirname "$0")/PANDUAN-MIGRASI.md" PANDUAN-MIGRASI.md 2>/dev/null || true

echo "[6/6] Membuat arsip tar.gz..."
tar -czf "$OUT_DIR/spsm-migration-$STAMP.tar.gz" -C "$WORK" spsm-migration
rm -rf "$WORK"

echo ""
echo "Selesai: $OUT_DIR/spsm-migration-$STAMP.tar.gz"
ls -lh "$OUT_DIR/spsm-migration-$STAMP.tar.gz"
