# SPSM — Sarana Pengajuan Skripsi Mahasiswa

Sistem digitalisasi pengajuan judul skripsi mahasiswa: dari pengajuan N opsi judul (jumlah dinamis via `system_settings.required_title_count`), screening Dosen Penilai, plenokan Kaprodi, penerbitan SK berlapis (TU → TTD Dekan → scan SK), hingga repository file skripsi.

## Struktur Project

| Folder | Deskripsi |
|---|---|
| `src/` | Mobile app mahasiswa — Expo SDK 58 + Expo Router + TypeScript |
| `web/` | Portal web React + Vite (Reviewer, Kaprodi, Admin) |
| `web_app/` | Portal web statis (Handlebars + Vite) — termasuk halaman Akademik/TU |
| `docs/` | Spesifikasi & dokumentasi teknis |
| `scripts/` | `init-spsm-db.mjs` — reset & setup penuh database Appwrite (`npm run db:init`) |

## Backend

Appwrite (`https://sgp.cloud.appwrite.io`, project `6af1b3b200056ab6bc1d`, database `spsm_db`). Setup database: `npm run db:init`.

Detail lengkap: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) · Spesifikasi: [dokumen_spesifikasi_teknis_lengkap_spsm_v2_1.md](dokumen_spesifikasi_teknis_lengkap_spsm_v2_1.md)

## Perintah

```bash
npx expo start          # mobile app
npm run portal          # web portal (web/ atau web_app/ tergantung prefix)
npm run db:init         # reset & init database Appwrite
npx tsc --noEmit        # typecheck
```
