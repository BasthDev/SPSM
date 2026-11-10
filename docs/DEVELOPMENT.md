# SPSM-KU — Dokumentasi Project

Sistem Pengajuan Judul Skripsi Mahasiswa — aplikasi mobile (Expo/React Native) untuk mahasiswa mengajukan judul skripsi, tracking status review dosen & Kaprodi, upload file skripsi, dan repository file.

---

## 1. Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | Expo SDK ~58, Expo Router (file-based, root `src/app`) |
| UI | React Native 0.88, React 19, TypeScript |
| Icons | lucide-react-native |
| Backend | Appwrite (Auth, Database, Storage) via `react-native-appwrite` |
| File picker | expo-document-picker |
| File system | expo-file-system/legacy |
| Browser/Share | expo-web-browser, expo-sharing |
| PDF viewer | react-native-webview (Google/Office online viewer) |
| AI | Google Gemini 2.0 Flash (similarity check) |

---

## 2. Struktur Folder

```
src/
├── app/                      # Expo Router screens
│   ├── _layout.tsx           # Root Stack + SafeAreaProvider
│   ├── index.tsx             # Landing/splash redirect
│   ├── login.tsx             # Login (Google OAuth)
│   ├── onboarding.tsx        # Isi data diri pertama kali
│   ├── dashboard.tsx         # Dashboard utama + GridNav + riwayat pengajuan
│   ├── logout.tsx
│   ├── submission/
│   │   ├── create.tsx        # Form ajukan judul (5 step)
│   │   └── [id].tsx          # Detail pengajuan + SK + upload skripsi
│   ├── skripsiku/
│   │   ├── index.tsx         # File saya (hanya file sendiri, upload disabled)
│   │   └── read.tsx          # Viewer dokumen (WebView + fullscreen)
│   ├── repo/index.tsx        # Semua file + pencarian nama
│   ├── profil/index.tsx      # Profil user
│   └── panduan/index.tsx     # Panduan interaktif + Q&A
├── components/               # Komponen reusable (AppHeader, Section, dst)
├── models/types.ts           # Types + ID collection/bucket
├── services/
│   ├── appwrite.ts           # Client, account, databases, storage
│   ├── authService.ts        # Auth, profil, markThesisUploaded
│   ├── submissionService.ts  # CRUD pengajuan + getComparableTitles
│   ├── academicService.ts    # Prodi, angkatan, dosen
│   ├── settingsService.ts    # Periode pengajuan
│   └── geminiService.ts      # Similarity check judul (BARU)
├── screens/submission/       # SubmissionDetailScreen (legacy wrapper)
└── theme/theme.ts            # Warna & style tokens
scripts/
└── setup-attributes.mjs      # Setup attribute Appwrite (jalankan 1x)
```

---

## 3. Appwrite Configuration

- **Endpoint:** `https://sgp.cloud.appwrite.io/v1`
- **Project ID:** `6af1b3b200056ab6bc1d`
- **Database:** `spsm_db`
- **Bucket Storage:** `journal_files`
- **Package name:** `id.my.basthdev.spsm`

### Collections

| Collection | Isi |
|---|---|
| `users` | Profil mahasiswa (user_id, nim, prodi, angkatan, `has_uploaded_thesis`) |
| `thesis_submissions` | Header pengajuan (student_id, status, submitted_at, nomor_surat, dll) |
| `submission_options` | 3 opsi judul per pengajuan (title, background, journal_*, relevance_*) |
| `approval_logs` | Jejak review (VERIFIKASI_DOSEN_PENILAI, DISAHKAN_KAPRODI, MINTA_REVISI, DITOLAK, PENGAJUAN_MAHASISWA, UPLOAD_SKRSIPSI) |
| `departments`, `batch_years`, `lecturers` | Data akademik |

### Konvensi File Storage

- Nama file di bucket: `owner_<userId>__<namaAsli>.pdf`
  - Prefix `owner_<userId>__` dipakai untuk filter "file saya" di Skripsi Ku (Storage tidak punya field owner & tidak support `Query.search` tanpa fulltext index → filter client-side dengan pagination)
- Permissions file: `read("any")` + `update/delete("user:<id>")`
- File skripsi yang diupload dari halaman detail dicatat sebagai log `UPLOAD_SKRSIPSI` di `approval_logs` dengan notes JSON `{text, file_id, file_name, size}` — jadi link file↔submission tersimpan tanpa attribute baru

---

## 4. Fitur Utama & Cara Kerja

### Auth & Onboarding
- Login Google OAuth → `appwrite-callback-<project>` scheme
- Pertama login → redirect `/onboarding` → simpan profil ke `users`

### Dashboard
- Hero card ajukan judul, status terkini, GridNav 4 menu (Repo, Skripsi Ku, Profil, Panduan)
- Riwayat pengajuan: kartu collapse default, expand menampilkan detail; badge status solid di pojok kanan atas (`top:-10, right:10`)

### Pengajuan Judul (`submission/create.tsx`)
- 5 step: Judul 1-3 → Dosen → Kirim
- Tiap opsi: judul, latar belakang, referensi jurnal (judul/penulis/**tahun**), tabel relevansi (variabel, metodologi, kesesuaian)
- **Cek kemiripan judul** sebelum submit (lihat bagian Gemini)
- Upload PDF jurnal opsional per opsi → `journal_files`

### Detail Pengajuan (`submission/[id].tsx`)
- Stepper 3 tahap + tanggal verifikasi; kartu SK resmi jika approved
- Upload file skripsi (hanya status `approved`) → `journal_files` + log `UPLOAD_SKRSIPSI` + set `has_uploaded_thesis=true` di users
- Opsi judul: kartu expandable, opsi terpilih selalu terbuka

### Skripsi Ku (`skripsiku/`)
- Hanya menampilkan file dengan prefix `owner_<userId>__` milik user login
- Upload **dinonaktifkan** (kode masih ada) — upload resmi lewat halaman detail
- `read.tsx`: viewer WebView (Google Docs untuk PDF, Office Online untuk Word), fullscreen/minimize tanpa reload (WebView tetap mounted + `key` stabil + `cacheEnabled`), tombol Buka (raw URI ke browser) & Unduh

### Repo (`repo/`)
- Semua file di bucket, view-only, pencarian nama real-time

### Panduan (`panduan/`)
- Accordion panduan + tab Q&A interaktif

---

## 5. Gemini Similarity Check (BARU)

**File:** `src/services/geminiService.ts`

### Env variable
```
EXPO_PUBLIC_GEMINI_API_KEY=<key>
```
Tambahkan di `.env`, lalu `npx expo start -c`.

### Flow saat submit judul
1. `submissionService.getComparableTitles()` — ambil semua judul dari `submission_options` milik submission aktif (exclude `rejected`/`revision`), dedupe, paginate 100/req
2. `checkTitleSimilarity(judulBaru[], judulLama[])`:
   - **Exact match** (tanpa AI): normalisasi (lowercase, buang stopwords) → identical / ≥80% containment → level `tinggi`
   - **Gemini 2.0 Flash** (`generateContent`, `responseMimeType: application/json`): prompt berisi daftar judul baru + judul lama → return level `tinggi`/`sedang`/`rendah` + alasan
3. Hasil di `create.tsx`:
   - `tinggi` → **batalkan pengajuan** + alert judul yang mirip
   - `sedang` → peringatan + pilihan "Tetap Ajukan" / "Kembali & Perbaiki"
   - Gemini gagal/tanpa key → skip cek, pengajuan tetap jalan

### Catatan keamanan
- API key ada di client (`EXPO_PUBLIC_`) → bisa di-extract dari app. Untuk production sebaiknya pindah ke Appwrite Function.
- Cek ini client-side → bisa di-bypass; reviewer tetap bisa verifikasi manual.

---

## 6. Perubahan Terbaru (Update Database)

### Attribute baru yang HARUS dibuat di Appwrite

Jalankan: `APPWRITE_API_KEY=<key> node scripts/setup-attributes.mjs`
(API key dari Appwrite Console → API Keys. Bukan session user.)

Atau buat manual di Console → Database → `spsm_db`:

**`submission_options`** (semua string, optional):
| Attribute | Size |
|---|---|
| `relevance_variable` | 1000 |
| `relevance_methodology` | 1000 |
| `relevance_note` | 2000 |
| `journal_year` | 50 |

**`users`**:
| Attribute | Type |
|---|---|
| `has_uploaded_thesis` | boolean |

> ⚠️ Tanpa attribute ini, `createSubmission` akan error "attribute not found".

### Perubahan kode terkait
- `createSubmission` sekarang menulis `relevance_*` & `journal_year` sebagai **kolom dedicated** (tidak lagi encode `<!-- RELEVANCE_DATA -->` di dalam `background`). Data lama tetap terbaca via `parseOptionRelevance` (fallback).
- Form create punya input **Tahun Terbit Jurnal** terpisah dari Penulis.
- `authService.markThesisUploaded(userId)` → set `has_uploaded_thesis=true` setelah upload skripsi (dipanggil dari detail page & skripsiku).
- `getFileViewUrl` diperbaiki: `getFileView` → `getFileViewURL` (yang lama return Promise → `[object Promise]`).

---

## 7. Environment Variables

```.env
APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=6af1b3b200056ab6bc1d
EXPO_PUBLIC_GEMINI_API_KEY=<key>
```

---

## 8. Known Limitations / TODO

- `react-native-pdf` tidak dipakai (butuh native build) — viewer pakai WebView + online viewer
- Konversi Word→PDF (mammoth/expo-print) sudah dihapus — file asli dirender viewer
- File `.doc`/`.docx` lama di bucket tetap bisa dilihat via Office viewer
- Upload di Skripsi Ku disabled — kode `handlePickDocument` masih ada untuk dipakai kembali
- Gemini check ada di client — pertimbangkan Appwrite Function untuk production
- `has_uploaded_thesis` belum dipakai di UI manapun — disiapkan untuk fitur berikutnya
