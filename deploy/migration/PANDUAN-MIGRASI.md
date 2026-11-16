# Panduan Migrasi SPSM ke Server Baru

Panduan memindahkan **seluruh** sistem SPSM (backend API, web dashboard, PocketBase database, Cloudflare Tunnel, auto-deploy) dari server lama ke server baru — cukup **satu file arsip**, tanpa `git clone` manual.

---

## Yang dimigrasikan

| Komponen | Isi |
|---|---|
| `spsm-root/` | `docker-compose.yml`, backend API + `.env`, PocketBase `pb_data` (database penuh), web dashboard `dist`, nginx configs |
| `spsm-app/` | Source code lengkap + `.git` (auto-deploy tetap berfungsi) |
| `cloudflared/` | Config + credentials tunnel → **DNS tidak perlu diubah** |
| `crontab.txt` | Auto-deploy tiap menit (git pull → rebuild web & api) |
| `manifest.txt` | Tanggal & commit hash saat pack dibuat |
| `restore.sh` | Installer otomatis di server baru |

---

## SEBELUM migrasi — di server LAMA

### 1. Pastikan kode terbaru sudah ter-push

```bash
cd /home/basth/spsm-app
git status          # pastikan tidak ada perubahan belum di-commit
git push            # kirim commit terbaru ke GitHub
```

> Auto-deploy & `.git` di dalam pack mengikuti commit terakhir yang sudah di-push.

### 2. Buat migration pack

```bash
sudo bash /home/basth/pack-migration.sh
```

Script ini akan:
- Stop container PocketBase **sementara** (±5 detik) agar database ter-backup konsisten, lalu start lagi otomatis
- Mengumpulkan semua file ke satu arsip

Hasil:

```
/home/basth/spsm-migration-YYYYMMDD-HHMMSS.tar.gz   (~104 MB)
```

> Script `pack-migration.sh` ada di `deploy/migration/` repo — bisa di-copy ke server mana pun yang menjalankan stack yang sama.

### 3. (Opsional) Download arsip ke komputer lokal

```bash
# dari Windows (PowerShell/Git Bash)
scp -P <port> basth@<server-lama>:/home/basth/spsm-migration-*.tar.gz D:\
```

---

## DI server BARU — langkah restore

### Prasyarat

- Ubuntu/Debian Server dengan akses `sudo`
- Koneksi internet (untuk install Docker, cloudflared, dan pull image)
- **Port yang harus bebas**: `5000` (API), `8081` (web dash), `8082` (PocketBase UI), `8090` (PocketBase)

### 1. Upload & extract arsip

```bash
# upload file ke server baru (dari lokal)
scp spsm-migration-*.tar.gz user@server-baru:~/

# di server baru
ssh user@server-baru
tar -xzf spsm-migration-*.tar.gz
cd spsm-migration
```

### 2. Jalankan restore

```bash
sudo bash restore.sh
```

Script akan otomatis (±3-5 menit):

1. **Install Docker** + docker compose plugin (bila belum ada)
2. **Extract** `spsm-root` & `spsm-app` ke `/home/basth/`
3. **Pasang Cloudflare Tunnel** — copy credentials, buat systemd service, auto-start saat boot
4. **Pasang crontab** auto-deploy untuk user `basth`
5. **`docker compose up -d`** — start pocketbase, api, web, pbui
6. **Verifikasi** — test endpoint lokal dan tampilkan status

> Kalau user di server baru bukan `basth`, jalankan:
> ```bash
> sudo SPSM_USER=<nama-user> bash restore.sh
> ```

### 3. Verifikasi hasil

```bash
# status container — semua harus "Up"
cd /home/basth/spsm-root
docker compose ps

# test endpoint lokal
curl http://localhost:5000/api/settings   # expect 200
curl http://localhost:8081                # expect HTML dashboard
curl http://localhost:8090/api/health     # expect PocketBase OK

# test tunnel
systemctl status cloudflared              # expect active (running)
```

Setelah itu buka dari browser:

- `https://dash.basthstudio.my.id` — dashboard
- `https://spsmapi.basthstudio.my.id/api/settings` — API
- `https://spsm.basthstudio.my.id` — PocketBase UI

Semua harus langsung jalan **tanpa mengubah DNS sama sekali** — karena tunnel credentials yang sama dipakai.

---

## Setelah migrasi berhasil

### Matikan stack di server LAMA (penting!)

Agar tidak ada 2 instance jalan bersamaan (data PocketBase bisa divergen):

```bash
cd /home/basth/spsm-root
docker compose down
sudo systemctl disable --now cloudflared
crontab -r   # atau hapus baris deploy-auto.sh saja
```

### Update berkala di server BARU

Auto-deploy sudah terpasang via crontab — setiap `git push` ke `main`:

- Perubahan `web_dash/` → auto rebuild + sync dist → nginx langsung serve
- Perubahan `server/` → auto rebuild + restart `spsm-api`

Log deploy: `/home/basth/spsm-app/deploy.log`

### Backup rutin (opsional tapi disarankan)

```bash
# di server baru, untuk snapshot data terbaru
sudo bash /home/basth/pack-migration.sh
```

Simpan arsip hasilnya di tempat aman — bisa dipakai untuk restore lagi atau migrasi ke server lain.

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `docker: command not found` setelah restore | Docker gagal install | Cek `apt-get install -f -y`, ulangi `restore.sh` |
| Endpoint `localhost:5000` tidak 200 | API crash | `docker compose logs api` di `spsm-root` |
| Tunnel tidak connect | Credentials salah / config path | `systemctl status cloudflared`, cek `/etc/cloudflared/config.yml` |
| Dashboard tampil tapi data kosong | `pb_data` tidak ikut | Pastikan pack dibuat SETELAH `pb_data` ada; restore ulang |
| `permission denied` saat pack | File `/etc/cloudflared` milik root | Selalu jalankan pack dengan `sudo` |
| Dua server jalan bersamaan | Lupa matikan yang lama | `docker compose down` di server lama — **wajib** |

---

## Ringkasan alur singkat

```
SERVER LAMA                          SERVER BARU
──────────                          ───────────
git push ──────────────► GitHub ◄── git pull (otomatis via cron)
sudo pack-migration.sh ─► .tar.gz ──► scp upload
                            │
                            └──► extract → sudo bash restore.sh
                                                   │
                                                   └──► SEMUA LIVE ✅
                                                       (DNS tetap, tunnel ikut)
```
