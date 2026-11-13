# Deploy SPSM-KU Self-Hosted: Appwrite + Backend dalam 1 Server (Docker, Ubuntu)

Target: satu server **Ubuntu** menjalankan **Appwrite self-hosted** + **backend API SPSM-KU** dalam Docker. Deploy via **git clone dari GitHub**.

```
Internet
   │
   ▼
Traefik (bawaan installer Appwrite)  :80 / :443
   ├── app-spsm.unmuha.ac.id   → Appwrite Console + API (/v1)
   └── api-spsm.unmuha.ac.id   → Backend SPSM-KU (container spsm-api)
                                      │
                                      ▼
                               Appwrite API (project, DB, storage)
```

## 0. Persiapan VM (Proxmox → Ubuntu)

Server berjalan sebagai **VM baru di Proxmox** — dedicated untuk SPSM, jadi port 80/443 kosong dan tidak ada konflik dengan service lain.

### Buat VM di Proxmox

| Setting | Rekomendasi |
|---|---|
| OS | Ubuntu 24.04 LTS (template di local storage) |
| vCPU | 2 core |
| RAM | **4GB minimum** (Appwrite + backend butuh ~2.5-3GB; 8GB lebih lega) |
| Disk | 32GB+ (SSD/LVM thin) |
| Network | bridged ke network kampus yang punya IP publik / bisa di-forward |
| DNS | `app-spsm.unmuha.ac.id` dan `api-spsm.unmuha.ac.id` — **A record → IP VM** (aturlah di DNS kampus sebelum mulai) |

> **Penting**: VM harus bisa di-reach dari internet di port 80 & 443 (untuk SSL Let's Encrypt + akses user). Kalau VM di belakang NAT Proxmox, atur **port forwarding di firewall/node Proxmox** atau mintakan IP publik langsung.

### Di dalam VM Ubuntu

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# logout lalu login ulang, lalu:
sudo systemctl enable --now docker
docker compose version   # harus v2.x
```

## 1. Clone Project dari GitHub

```bash
git clone <URL-REPO-GITHUB> spsm
cd spsm/server
```

Pastikan `server/` berisi `Dockerfile`, `docker-compose.yml`, `.env.example`, `package.json`, `tsconfig.json`, `src/`.

## 2. Install Appwrite Self-Hosted

Installer resmi membuat folder `./appwrite` berisi compose + Traefik:

```bash
cd ~
docker run -it --rm \
  --publish 20080:20080 \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --volume "$(pwd)"/appwrite:/usr/src/code/appwrite:rw \
  --entrypoint="install" \
  appwrite/appwrite:2.7.2
```

Buka `http://IP-SERVER:20080` di browser → wizard 4 langkah:

1. **Setup your app**
   - Hostname: `app-spsm.unmuha.ac.id`
   - Use HTTPS: **ON**
   - Database: **PostgreSQL** (default)
   - Ports: default (80/443)
2. **Secure your app** — simpan API key internal yang dibuat (untuk keperluan wizard)
3. **Create your account** — email+password Console admin
4. **Install** — tunggu 5-15 menit (pull banyak image)

```bash
cd ~/appwrite && docker compose ps   # semua service harus up/healthy
```

Buka `https://app-spsm.unmuha.ac.id` → login Console.

> **Catatan versi**: installer di atas pakai image `2.7.2` (terbaru saat panduan ini ditulis). Cek tag terbaru di https://hub.docker.com/r/appwrite/appwrite/tags — untuk migrasi dari cloud, versi ≥1.9.5 disarankan karena membawa konfigurasi project (API key, OAuth, dsb) ikut termigrasi.

## 3. Migrasi Data dari Appwrite Cloud → Self-Hosted

Appwrite punya fitur migrasi resmi (Cloud Console → Settings → **Migrations** → *Export to self-hosted instance*). Ini memindahkan accounts, databases+rows, files, functions, sites — **non-destruktif** (data cloud tidak dihapus).

### Langkah

1. Pastikan self-hosted sudah jalan dan **bisa diakses internet** (`https://app-spsm.unmuha.ac.id` resolve & Traefik SSL sudah jalan).
2. Di **Appwrite Cloud Console** (project lama): Settings → Migrations → **Export data**.
3. Ikuti wizard — akan redirect ke Console **self-hosted**, pilih organization/project tujuan (bisa project baru atau existing; project ID boleh sama maupun baru — backend `.env` tinggal disesuaikan).
4. Pilih data yang dimigrasikan → **Start Migration**. Proses berjalan di background; tidak perlu halaman Console tetap terbuka.
5. Migrasi memakai **API key dari project cloud (sumber)** — buat di Cloud Console → Settings → API Keys dengan scope yang dibutuhkan. Setelah selesai, revoke key itu.

### Yang ikut & tidak ikut

| Ikut otomatis | Catatan |
|---|---|
| Users/accounts | Termasuk kredensial Google OAuth |
| Databases + rows | Semua koleksi & dokumen |
| Files/storage | Bucket + file |
| Project config (≥1.9.5) | API keys, OAuth providers, variables, security policies |

| Tidak/terbatas | Catatan |
|---|---|
| `$createdAt`/`$updatedAt` | **Di-reset ke tanggal migrasi** — tidak masalah untuk sistem kita (realtime watermark & sorting pakai urutan relatif, bukan tanggal absolut; `submitted_at` adalah field biasa jadi tetap utuh) |
| OAuth redirect URL | Domain cloud ≠ domain self-hosted → **wajib update** di Google Cloud Console & Appwrite Auth settings setelah migrasi |
| FCM/Messaging config | Cek ulang provider messaging pasca-migrasi |

### ⚠️ Known issue (dari komunitas Appwrite)

Ada laporan bug di versi lama di mana **databases/rows bisa skip diam-diam** saat migrasi (status "sukses" tapi 0 rows). Setelah migrasi **wajib verifikasi**:

```bash
# Bandingkan jumlah dokumen per koleksi cloud vs self-hosted
# via Console masing-masing, atau REST API:
curl "https://app-spsm.unmuha.ac.id/v1/databases/spsm_db/collections/thesis_submissions/documents?queries[]=limit(1)" \
  -H "X-Appwrite-Project: <PROJECT_ID>" -H "X-Appwrite-Key: <API_KEY>"
```

Kalau rows kosong padahal harusnya ada → update Appwrite ke versi terbaru lalu ulangi migrasi, atau migrasi databases manual via API (export rows → insert).

### Kalau migrasi gagal total (fallback manual)

Script Node sederhana bisa dibuat: fetch semua dokumen per koleksi dari cloud REST API → POST ke self-hosted dengan API key masing-masing. Struktur row Appwrite beda tipis (atribut nested) — butuh mapping. Kabari saya kalau perlu saya buatkan script-nya.

## 4. Setup Backend `.env`

```bash
cd ~/spsm/server
cp .env.example .env
nano .env
```

```env
PORT=5000
NODE_ENV=production
JWT_SECRET=<generate: openssl rand -hex 32>

# Appwrite self-hosted — endpoint publik via Traefik
APPWRITE_ENDPOINT=https://app-spsm.unmuha.ac.id/v1
APPWRITE_PROJECT_ID=<project-id-setelah-migrasi>
APPWRITE_API_KEY=<api-key-server-di-project-selfhosted>
APPWRITE_DATABASE_ID=spsm_db

API_DOMAIN=api-spsm.unmuha.ac.id
APPWRITE_NETWORK=appwrite_appwrite
```

Cek nama network yang benar:

```bash
docker network ls | grep appwrite
# Yang dipakai Traefik untuk route ke container appwrite:
docker inspect appwrite-traefik --format '{{json .NetworkSettings.Networks}}' | tr ',' '\n' | grep NetworkID
```

`APPWRITE_NETWORK` = network tempat container `appwrite` berada (tempat backend join agar bisa resolve service internal & Traefik bisa reach). Biasanya `appwrite_appwrite`.

### API Key backend

Buat di self-hosted Console → project → Settings → API Keys → Create, scope minimal:

```
databases.read  databases.write
databases.read  databases.write  (per collection atau all)
users.read  users.write
files.read  files.write
teams.read  (bila dipakai)
```

> Migrasi ≥1.9.5 membawa API keys cloud ikut — tapi tetap buat key baru khusus backend dengan scope minimal (least privilege).

### FCM service account (push notif)

```bash
mkdir -p ~/secrets && chmod 700 ~/secrets
# upload service-account.json Firebase ke ~/secrets/
chmod 600 ~/secrets/service-account.json
```

Buat `server/docker-compose.override.yml`:

```yaml
services:
  api:
    volumes:
      - /home/USER/secrets/service-account.json:/run/secrets/fcm-service-account.json:ro
```

dan `.env`: `FCM_SERVICE_ACCOUNT_PATH=/run/secrets/fcm-service-account.json`

## 5. Build & Jalankan Backend

```bash
cd ~/spsm/server
docker compose up -d --build
docker compose logs -f api
```

Container `spsm-api` join network Appwrite → Traefik me-route `api-spsm.unmuha.ac.id` ke port 5000 (HTTP+HTTPS). Realtime bridge & period watcher ikut jalan.

## 6. Verifikasi

```bash
curl https://api-spsm.unmuha.ac.id/health          # → status ok
docker exec spsm-api wget -qO- http://localhost:5000/health
docker compose -f ~/spsm/server/docker-compose.yml logs api | grep rt
```

Di app:
- Login Google → OAuth lewat `app-spsm.unmuha.ac.id` → kembali ke app
- Dashboard → log `[rt] client connected` muncul
- Ubah data → UI update ~15-20 detik

## 7. Update Mobile App

```env
EXPO_PUBLIC_API_URL=https://api-spsm.unmuha.ac.id/api
```

Restart Metro (`npx expo start --clear`) / rebuild EAS. Realtime otomatis `wss://`.

## 8. DNS & Jaringan Checklist

Karena VM dedicated, pakai **port standar 80/443** — tidak perlu port forwarding khusus.

- [ ] `app-spsm.unmuha.ac.id` A record → IP VM
- [ ] `api-spsm.unmuha.ac.id` A record → IP VM (sama — Traefik membedakan via Host header)
- [ ] Port 80 & 443 publik reachable ke VM (firewall kampus/node Proxmox mengizinkan)
- [ ] Port 20080 **tutup** setelah instalasi Appwrite selesai

```bash
# Di VM:
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
# Opsional batasi SSH: sudo ufw allow from <IP-kamu> to any port 22

# Verifikasi dari luar (PC lain):
curl -I http://app-spsm.unmuha.ac.id   # harus dapat response Traefik
```

**Kalau IP VM tidak publik** (di belakang NAT Proxmox/firewall kampus): minta admin port-forward `80→80` dan `443→443` ke IP VM, atau alokasi IP publik untuk VM tersebut.

## 9. Operasional

| Tugas | Perintah |
|---|---|
| Log backend | `cd ~/spsm/server && docker compose logs -f api` |
| Restart backend | `docker compose restart api` |
| Deploy update kode | `cd ~/spsm && git pull && cd server && docker compose up -d --build` |
| Update Appwrite | `cd ~/appwrite && docker compose pull && docker compose up -d` — **WAJIB baca panduan migrasi versi + backup dulu** |
| Backup Appwrite | pg_dump postgres container + volume `appwrite-uploads` |
| Backup backend | stateless — cukup `server/.env` |
| Backup keseluruhan | **Proxmox snapshot/backup VM** (Datacenter → VM → Backup) + `pg_dump` database Appwrite untuk backup granular |

## 10. Troubleshooting

| Gejala | Cek |
|---|---|
| `curl` timeout | DNS record, firewall 80/443, `docker compose ps` |
| 404/503 Traefik | `APPWRITE_NETWORK` salah — cek `docker network ls`, pastikan `spsm-api` satu network dengan `appwrite` |
| SSL api-spsm gagal terbit | `docker logs appwrite-traefik` cari error ACME; pastikan DNS sudah resolve sebelum router dibuat |
| Backend tidak reach Appwrite | `docker exec spsm-api wget -qO- https://app-spsm.unmuha.ac.id/v1/health/version` |
| Login Google gagal | Redirect URI Google Cloud Console harus include `https://app-spsm.unmuha.ac.id/v1/account/sessions/oauth2/callback` |
| Migrasi: rows kosong | Known bug — update Appwrite / verifikasi per koleksi |
| WS realtime putus | Lewat Traefik otomatis support Upgrade; cek `docker logs spsm-api` |

## Catatan Penting

- **Update Appwrite self-hosted tidak otomatis** — selalu backup + baca release notes/migration guide sebelum `pull`.
- **`$updatedAt` reset saat migrasi** tidak masalah: realtime bridge membangun baseline watermark fresh saat start.
- **JWT_SECRET** di `.env` backend berlaku untuk semua sesi lama — setelah deploy pertama, token cloud lama tidak dipakai lagi (user login ulang normal).
- **Realtime bridge tetap delta-polling** (15s) — beban ke Appwrite self-hosted sangat kecil, aman untuk server kampus.
