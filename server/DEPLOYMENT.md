# Setup Backend SPSM di Server Sendiri

Panduan deploy `server/` ke server hardware milik sendiri (Linux disarankan; Windows Server juga bisa).

## 1. Prasyarat di Server

- **Node.js 20 LTS** (disarankan) — cek: `node -v`
- **npm** (sudah termasuk Node.js)
- Akses SSH ke server
- Opsional tapi disarankan: **domain** (mis. `api.domainkamu.com`) + sertifikat HTTPS

Install di Ubuntu/Debian:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x
```

## 2. Upload & Install Project

```bash
# Di server:
git clone <repo-kamu> spsm
cd spsm/server
npm ci          # atau npm install
npm run build   # hasilkan dist/
```

Atau upload folder `server/` via `scp`/`rsync` lalu `npm install && npm run build`.

## 3. File Environment (`server/.env`)

Buat `server/.env` di server (JANGAN di-commit ke git):

```env
PORT=5000
NODE_ENV=production
JWT_SECRET=<random-string-panjang,-generate-dengan: openssl rand -hex 32>

APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=6af1b3b200056ab6bc1d
APPWRITE_API_KEY=<api-key-appwrite>
APPWRITE_DATABASE_ID=spsm_db

# FCM push notifications (wajib untuk notif realtime & periode)
FCM_SERVICE_ACCOUNT_PATH=/etc/spsm/service-account.json
# atau inline JSON: FCM_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'

# Opsional: Gemini untuk validasi judul
GEMINI_API_KEY=<key>
```

Catatan:
- `JWT_SECRET` **harus beda** dari default dan jangan sampai bocor — semua token sesi pakai ini.
- Service account FCM: taruh file JSON di server (mis. `/etc/spsm/`), `chmod 600`, jangan di repo.

## 4. Menjalankan sebagai Service (PM2 — recommended)

```bash
sudo npm install -g pm2
cd /path/to/spsm/server
pm2 start dist/index.js --name spsm-api
pm2 save
pm2 startup    # ikuti instruksi agar auto-start saat reboot
```

Cek log: `pm2 logs spsm-api`

Alternatif systemd (`/etc/systemd/system/spsm-api.service`):

```ini
[Unit]
Description=SPSM API
After=network.target

[Service]
WorkingDirectory=/path/to/spsm/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 5. Reverse Proxy + HTTPS (Nginx)

WebSocket butuh proxy support. Contoh `/etc/nginx/sites-available/spsm`:

```nginx
server {
    listen 80;
    server_name api.domainkamu.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # WAJIB untuk WebSocket realtime
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout panjang untuk koneksi WS idle
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/spsm /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

HTTPS dengan Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.domainkamu.com
```

Certbot otomatis menambah `listen 443 ssl` + redirect HTTP→HTTPS; konfigurasi `location /` tetap berlaku untuk WS.

> **Catatan:** WebSocket realtime akan otomatis pakai `wss://` karena `realtimeService` mobile mengubah `http`→`ws` dari `API_BASE_URL`. Pastikan `EXPO_PUBLIC_API_URL` di app point ke `https://api.domainkamu.com/api`.

## 6. Firewall

```bash
# Ubuntu ufw — hanya buka 80/443, port 5000 cukup localhost (di belakang nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Kalau tidak pakai nginx (direct expose), buka `sudo ufw allow 5000/tcp` — tapi **tidak disarankan** karena WS tanpa TLS = token JWT terkirim plaintext.

## 7. Update Mobile App

Di `.env` app (atau EAS environment):

```env
EXPO_PUBLIC_API_URL=https://api.domainkamu.com/api
```

Lalu rebuild/restart Metro (`npx expo start --clear`). Tidak perlu `adb reverse` lagi.

## 8. Checklist Verifikasi

```bash
curl https://api.domainkamu.com/health        # → {"status":"ok",...}
```

- [ ] Login Google berhasil (oauth-session → JWT)
- [ ] Dashboard load data
- [ ] WS realtime connect (cek `pm2 logs` → `[rt] client connected`)
- [ ] Perubahan data di Appwrite → UI update dalam ~15-20 detik
- [ ] Push notif FCM sampai (jika service account terkonfigurasi)

## 9. Maintenance

- **Update kode**: `git pull && npm run build && pm2 restart spsm-api`
- **Backup `.env` & service account** — tidak masuk git
- **Rate limiting**: Appwrite-side sudah dihandle; jika perlu, tambah `express-rate-limit` di `app.ts` untuk endpoint auth
- **Monitoring**: `pm2 monit`, atau pasang Uptime Kuma/Healthchecks ke `/health`

## Yang TIDAK berubah saat pindah server

- Appwrite tetap cloud (`sgp.cloud.appwrite.io`) — server kamu hanya perantara API
- Realtime bridge tetap jalan (delta-poller → WS), tidak perlu port tambahan selain 443/80
- Struktur project sama: `npm run build` → `node dist/index.js`
