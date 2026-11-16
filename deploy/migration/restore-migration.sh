#!/bin/bash
# restore-migration.sh — Restore SPSM dari hasil pack-migration.sh di server BARU.
#
# Pemakaian (setelah extract arsip, di direktori spsm-migration/):
#   sudo bash restore.sh
#
# Yang dilakukan:
#   1. Install Docker (bila belum ada) + docker compose plugin
#   2. Extract spsm-root & spsm-app ke /home/basth/
#   3. Pasang cloudflared tunnel (credentials + config) sebagai systemd service
#   4. Pasang crontab auto-deploy
#   5. docker compose up -d + verifikasi endpoint
set -euo pipefail

# --- konfigurasi (ubah bila path/user berbeda) ---
TARGET_USER="${SPSM_USER:-basth}"
TARGET_HOME="/home/$TARGET_USER"
APP_DIR="$TARGET_HOME/spsm-app"
ROOT_DIR="$TARGET_HOME/spsm-root"
CF_DIR="/etc/cloudflared"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== Restore SPSM Migration =="
echo "Source : $SRC_DIR"
echo "Target : $ROOT_DIR & $APP_DIR (user: $TARGET_USER)"

# --- 0. Cek user target ada ---
if ! id "$TARGET_USER" >/dev/null 2>&1; then
  echo "User '$TARGET_USER' tidak ada. Buat dulu: sudo adduser $TARGET_USER"
  exit 1
fi

# --- 1. Docker ---
if ! command -v docker >/dev/null 2>&1; then
  echo "[1/5] Install Docker..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "[1/5] Docker sudah ada: $(docker --version)"
fi

# --- 2. Extract file ---
echo "[2/5] Extract ke $TARGET_HOME..."
mkdir -p "$TARGET_HOME"
cp -a "$SRC_DIR/spsm-root" "$ROOT_DIR"
cp -a "$SRC_DIR/spsm-app" "$APP_DIR"
chown -R "$TARGET_USER:$TARGET_USER" "$ROOT_DIR" "$APP_DIR" 2>/dev/null || true

# --- 3. Cloudflared tunnel ---
echo "[3/5] Pasang Cloudflare Tunnel..."
if [ -f "$SRC_DIR/cloudflared/config.yml" ]; then
  mkdir -p "$CF_DIR"
  cp -a "$SRC_DIR/cloudflared/." "$CF_DIR/"
  chmod 600 "$CF_DIR"/*.json 2>/dev/null || true

  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "  install cloudflared..."
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    dpkg -i /tmp/cloudflared.deb || apt-get install -f -y
  fi

  # systemd service (sama seperti server lama)
  cat > /etc/systemd/system/cloudflared.service <<EOF
[Unit]
Description=Cloudflare Tunnel client
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/bin/cloudflared --no-autoupdate --config $CF_DIR/config.yml tunnel run
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now cloudflared
  echo "  cloudflared: $(systemctl is-active cloudflared)"
else
  echo "  cloudflared config tidak ada di pack — skip (tunnel tidak dipasang)"
fi

# cert.pem opsional (untuk manajemen tunnel)
if [ -f "$SRC_DIR/cloudflared-home/cert.pem" ]; then
  mkdir -p "$TARGET_HOME/.cloudflared"
  cp -a "$SRC_DIR/cloudflared-home/cert.pem" "$TARGET_HOME/.cloudflared/"
  chown -R "$TARGET_USER:$TARGET_USER" "$TARGET_HOME/.cloudflared"
fi

# --- 4. Crontab auto-deploy ---
echo "[4/5] Pasang crontab auto-deploy..."
if [ -f "$SRC_DIR/crontab.txt" ] && [ -s "$SRC_DIR/crontab.txt" ]; then
  # crontab.txt berisi path lama (/home/basth/...) — ganti bila TARGET_HOME beda
  sed "s|/home/basth|$TARGET_HOME|g" "$SRC_DIR/crontab.txt" | crontab -u "$TARGET_USER" -
  echo "  crontab terpasang untuk $TARGET_USER"
else
  echo "  crontab.txt kosong/tidak ada — skip"
fi

# --- 5. Start stack ---
echo "[5/5] Menyalakan docker compose stack..."
cd "$ROOT_DIR"
docker compose up -d
sleep 5
echo ""
echo "Status container:"
docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || docker compose ps

echo ""
echo "== Verifikasi =="
for url in "http://localhost:5000/api/settings" "http://localhost:8081" "http://localhost:8082" "http://localhost:8090/api/health"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "FAIL")
  echo "  $url -> $code"
done

echo ""
echo "Selesai. Catatan:"
echo " - DNS Cloudflare TIDAK perlu diubah — tunnel credentials sama, hostname tetap resolve."
echo " - Pastikan port 5000/8081/8082/8090 tidak dipakai service lain di server ini."
echo " - Kalau PATH_USER beda, jalankan dengan: SPSM_USER=<user> sudo bash restore.sh"
