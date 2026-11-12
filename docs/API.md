# SPSM-KU — Dokumentasi API & Arsitektur (untuk Developer)

Dokumen ini adalah referensi lengkap untuk developer yang melanjutkan proyek SPSM-KU: struktur repo, semua service/API beserta cara pakai, skema database Appwrite, konvensi storage, dan alur status.

---

## 1. Gambaran Repo

```
D:\SPSM-KU
├── src/                  # Mobile app mahasiswa (Expo SDK ~58, Expo Router, TS)
│   ├── app/              # Routes: dashboard, submission/create, submission/[id],
│   │                     #   skripsiku, repo, profil, panduan, login, onboarding
│   ├── components/       # UI reusable + dashboard/ (PeriodInfoCard, EligibilityCard)
│   ├── models/types.ts   # SEMUA types + konstanta collection/bucket ID
│   ├── services/         # appwrite, authService, submissionService,
│   │                     #   academicService, settingsService, geminiService
│   └── theme/theme.ts    # Warna (Colors.primary = #204B76)
├── web/                  # Portal web React + Vite + TS (Reviewer/Kaprodi/Admin/Repo/Laporan)
│   └── src/services/     # appwrite (web SDK), authService, submissionService,
│                         #   settingsService, storageService, academicService
├── web_app/              # Portal web statis (Handlebars partials + vanilla JS + Vite)
│   ├── *.html            # signin, index(dashboard), reviewer, kaprodi, akademik,
│   │                     #   advisor, admin, reports, repo
│   └── src/js/           # appwrite.js, spsm.js (SEMUA service), main.js,
│                         #   per-halaman: dashboard/reviewer/kaprodi/akademik/dll
├── scripts/
│   └── init-spsm-db.mjs  # RESET & setup penuh database Appwrite
└── docs/                 # Spesifikasi v2.0/v2.1/v2.2 + DEVELOPMENT.md
```

**Penting:** `web_app` adalah MPA — setiap halaman HTML load bundle JS-nya sendiri. Service layer-nya ada di `src/js/spsm.js` dan sudah punya **memoization cache** (lihat §6).

---

## 2. Konfigurasi Appwrite

| Item | Nilai |
|---|---|
| Endpoint | `https://sgp.cloud.appwrite.io/v1` |
| Project ID | `6af1b3b200056ab6bc1d` |
| Database ID | `spsm_db` |
| Storage bucket | `journal_files` (dipakai untuk JURNAL dan SK — sama; plan Appwrite hanya mengizinkan 1 bucket). File SK discan diberi prefix `skscan_`, file referensi jurnal per-opsi diberi prefix `refopt_` — keduanya difilter keluar dari listing `journals`. API bucket logis `sk`/`journals` dipetakan server-side. |

Client sudah diinisialisasi di:
- Mobile: `src/services/appwrite.ts` → export `account`, `databases`, `storage`
- Web portal: `web/src/lib/appwrite.ts` → export `account`, `databases`, `storage`, `APPWRITE_CONFIG`, `ID`, `Query`
- web_app: `web_app/src/js/appwrite.js` + config di `spsm.js` (`APPWRITE_CONFIG`)

### Environment variables (mobile)

```env
APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=6af1b3b200056ab6bc1d
EXPO_PUBLIC_GEMINI_API_KEY=<key>   # opsional, untuk similarity check
```

---

## 3. Skema Database (`spsm_db`)

### `system_settings` — 1 dokumen, kontrol admin
| Attribute | Tipe | Keterangan |
|---|---|---|
| `is_active` | boolean | periode buka/tutup global |
| `start_date` / `end_date` | datetime | rentang pengajuan |
| `academic_year` | string | mis. `2025/2026 Ganjil` |
| `min_sks` | int | syarat SKS minimal (default 100) |
| `required_title_count` | int | **N judul wajib — dinamis, jangan hardcode 3** |
| `required_courses` | string[] | mata kuliah prasyarat |

### `users` — profil user
`user_id`, `name`, `email`, `role` (`student|lecturer|reviewer|kaprodi|akademik|admin`), `nim_or_nip`, `department`, `batch_year`, `current_sks`, `academic_requirements` (JSON string), `avatar_url`, `has_uploaded_thesis` (bool)

### `thesis_submissions` — header pengajuan
`student_id`, `advisor_id` (CSV lama), `advisor_1_id`, `advisor_2_id`, `preferred_advisor_1_id`, `preferred_advisor_2_id`, `reviewer_notes`, `status`, `submitted_at`

### `submission_options` — N opsi judul per submission
`submission_id`, `option_number`, `title`, `background`, `relevance_table` (JSON string), `relevance_variable`, `relevance_methodology`, `relevance_note`, `journal_title`, `journal_author`, `journal_year`, `journal_file_id`, `is_selected`, `is_selected_by_lecturer`

### `surat` — dokumen SK (Blueprint v2.2)
`submission_id`, `nomor_surat` (`NN/SPSM/PRODI/ANGK/TAHUN`), `urutan` (int), `no_dokumen`, `template_sk_id`, `scanned_sk_id`, `created_at`

### `approval_logs` — jejak audit
`submission_id`, `actor_id`, `action`, `notes`, `created_at`

**Action yang dipakai (WAJIB konsisten):**
`PENGAJUAN_MAHASISWA` (notes JSON `{pref1, pref1_name, pref2, pref2_name}`), `VERIFIKASI_DOSEN_PENILAI`, `DISAHKAN_KAPRODI` (notes JSON `{nomor_surat, urutan, generated_at, text}`), `MINTA_REVISI`, `DITOLAK` (notes format `Judul 1: ...\nJudul 2: ...`), `UPLOAD_SKRSIPSI` (notes JSON `{file_id, file_name, size}`)

### `departments`, `batch_years`, `lecturers`
`lecturers`: `nip`, `name`, `email`, `department_id`, `expertise`, `quota`, `current_students`, `role`, `is_active`

---

## 4. Status Pengajuan (v2.2)

```
pending_lecturer → waiting_kaprodi → waiting_akademik → sk_process → sk_issued
                        ↘ revision / rejected (bypass periode, bisa resubmit)
```

**Label badge kanonik (sudah dinormalisasi di semua app):**

| Status | Label |
|---|---|
| `drafting` | Draf |
| `pending_lecturer` | Menunggu Review |
| `waiting_kaprodi` | Pleno Kaprodi |
| `waiting_akademik` | Menunggu Administrasi TU |
| `sk_process` | Proses TTD Dekan |
| `sk_issued` / `approved` | SK Resmi Terbit |
| `revision` | Perlu Revisi |
| `rejected` | Ditolak |

---

## 5. Mobile App — Service Layer (`src/services/`)

### `appwrite.ts`
```ts
import { account, databases, storage } from '@/services/appwrite';
```

### `authService`
| Method | Fungsi |
|---|---|
| `getCurrentAccount()` | Appwrite account aktif |
| `getUserProfile(userId)` | Profil dari `users` |
| `markThesisUploaded(userId)` | set `has_uploaded_thesis=true` |
| `signOut()` | logout |

### `settingsService`
| Method | Fungsi |
|---|---|
| `getSettings()` | `SystemSettings` dari `system_settings` (fallback DEFAULT_SETTINGS) |
| `getPeriodDisplayStatus(settings)` | `{status: open/upcoming/closed, isOpen, ...}` untuk kartu periode |
| `evaluateStudentEligibility(settings, profile)` | cek `min_sks` + `required_courses` vs `academic_requirements` JSON → `{isEligible, studentSks, missingCourses, ...}` |
| `isPeriodOpen(settings)` | shortcut boolean + reason |

### `submissionService`
| Method | Fungsi |
|---|---|
| `createSubmission(studentId, optionsData, prefAdv1Id?, prefAdv2Id?)` | Buat submission + N options + upload PDF jurnal + log `PENGAJUAN_MAHASISWA` |
| `getStudentSubmissions(studentId)` | list header saja |
| `getStudentSubmissionsWithDetails(studentId)` | + hydrated (options, logs, advisors, surat) |
| `getSubmissionWithDetails(id)` | 1 submission hydrated / `null` |
| `hydrateSubmissions(subs)` | enrich array: options, logs, surat→nomor_surat, advisor1/2, preferredAdvisor1/2, kaprodi info, reviewerNotes, `revision_note` per option |
| `getSubmissionOptions(id)` / `getApprovalLogs(id)` / `getSubmissionSurat(id)` | query per collection |
| `getLecturer(id)` / `getLecturers()` | dosen (fallback cari by `nip`) |
| `getComparableTitles()` | **untuk similarity check** — semua judul KECUALI submission `rejected`/`revision`, dedupe, paginasi |
| `getFileViewUrl(fileId)` / `getFileDownloadUrl(fileId)` | URL publik bucket |

`OptionFormData`: `{number, title, background, journalTitle?, journalAuthor?, journalYear?, pdfFile?, relevanceVariable?, relevanceMethodology?, relevanceNote?}`

### `academicService`
`getDepartments()`, `getBatchYears()`, `getLecturers()` — data master.

### `geminiService`
`checkTitleSimilarity(newTitles[], existingTitles[])` → `{level: 'tinggi'|'sedang'|'rendah'|null, matches[], reason?}`
- Exact match (tanpa AI): normalisasi → identical / ≥80% containment = `tinggi`
- Gemini 2.0 Flash untuk penilaian topik (butuh `EXPO_PUBLIC_GEMINI_API_KEY`)
- Gemini gagal → skip, submission tetap jalan

---

## 6. web_app — Service Layer (`src/js/spsm.js`)

Semua service di-export sebagai object. **Sudah ada memoization:**

```js
import { submissionService, lecturerService, authService, settingsService, storageService } from './spsm.js';
```

### `submissionService`
| Method | Catatan |
|---|---|
| `getAllSubmissions(statusFilter?, advisorIdFilter?)` | **CACHED** per kombinasi filter. Hydrate: options, logs, student, advisors, surat |
| `invalidateSubmissionsCache()` | otomatis dipanggil semua method mutasi |
| `reviewAndSelectTitle(subId, optionId, adv1Id, adv2Id, reviewerName, notes)` | reviewer ACC → `waiting_kaprodi` + generate `surat` doc |
| `kaprodiApprove(subId, adv1Id, adv2Id, kaprodiName, notes)` | → `waiting_akademik` + generate nomor SK |
| `requestRevision(subId, actorName, notes)` | notes = `{opt1,opt2,opt3,general}` → format `Judul N:` |
| `rejectSubmission(subId, actorName, notes, advisorId)` | sama |
| `processDekanSignature(subId, staffName)` | `waiting_akademik` → `sk_process` |
| `uploadSignedSk(subId, file, staffName)` | upload scan → update `surat.scanned_sk_id` → `sk_issued` |
| `getFileViewUrl(fileId)` | |

### `lecturerService`
`getLecturers()` (**CACHED**), `createLecturer`, `updateLecturer`, `deleteLecturer`, `updateRole`, `syncStudentCount`, `invalidateLecturerCache()`

### `settingsService` (web_app)
`getSettings()` — baca `system_settings` collection (fallback parse JSON dokumen `SETTINGS_SYS` di departments); `updateSettings(settings)` — tulis ke collection + fallback.

### `authService` (web_app)
`getCurrentUser()` → `{account, profile, lecturer, isAdmin, role}`; `loginWithGoogle()`, `loginWithEmail()`, `logout()`

### `storageService` (web_app)
`listAllFiles()` (paginated), `getFileViewUrl()`, `getFileDownloadUrl()`

### Helper global
`formatDateShort(iso)`, `formatNomorSurat(urutan, prodiCode, angkatan, year)`

---

## 7. web/ Portal — Service Layer (`web/src/services/`)

Mirip mobile tapi pakai **web Appwrite SDK** (`account.createOAuth2Session`, `getFileView` return URL langsung — BEDA dengan RN SDK yang perlu `.toString()` via `getFileViewURL`).

`submissionService` punya method yang sama + `reviewAndSelectTitle`, `requestRevision`, `rejectSubmission`, `calculateTotalVerified()`. `storageService` untuk repo browser. `settingsService` sama (system_settings + fallback departments JSON).

---

## 8. Konvensi Penting (JANGAN dilanggar)

1. **Jumlah judul dinamis** — selalu `settings.required_title_count`, jangan hardcode 3 (sudah diterapkan di mobile `create.tsx`/`dashboard.tsx`/`EligibilityCard`, web `ReviewerView`/`KaprodiView`/`SubmissionDetailModal` via `options.length`, web_app teks generik).
2. **Status badge label** — pakai tabel kanonik di §4.
3. **Log action names** — persis seperti §3, terutama `PENGAJUAN_MAHASISWA` dengan JSON notes (diparse mobile & web_app untuk tampilkan calon pembimbing).
4. **Revision notes format** — `Judul 1: ...\nJudul 2: ...\nJudul 3: ...` (diparse `hydrateSubmissions` → `option.revision_note`).
5. **Nomor SK** — dokumen `surat` adalah source of truth; JSON di log `DISAHKAN_KAPRODI` hanya fallback data lama.
6. **File storage** — nama file `owner_<userId>__<nama>.pdf`; upload skripsi dicatat sebagai log `UPLOAD_SKRSIPSI`; `has_uploaded_thesis` di users.
7. **Eligibility** — `evaluateStudentEligibility` (SKS + courses) + `getPeriodDisplayStatus` + exemption revision/rejected — jangan bypass di UI manapun.
8. **Resubmit** — hanya status `revision`/`rejected`, prefill via `getSubmissionWithDetails`, blokir jika ada submission aktif (`pending_lecturer|waiting_kaprodi|waiting_akademik|sk_process|sk_issued|approved`).

---

## 9. Perintah Berguna

```bash
npx expo start          # mobile dev
npx tsc --noEmit        # typecheck mobile
cd web && npx tsc --noEmit && npm run dev    # web portal (port 5173)
cd web_app && npm run dev                    # web_app (port 3000)
cd web_app && npm run build                  # build statis → dist/
npm run db:init         # RESET database Appwrite (hati-hati!)
npx expo lint           # lint mobile
```

## 10. Catatan untuk Developer Berikutnya

- **Jangan edit `ios/`/`android/`** — generated (CNG).
- Mobile pakai `react-native-appwrite`; web pakai `appwrite` web SDK — API method mirip tapi `getFileView` berbeda (RN: `getFileViewURL().toString()`, web: `getFileView()` langsung URL).
- `web_app` cache di `spsm.js` di-invalidate otomatis oleh method mutasi — kalau tambah method tulis baru, panggil `this.invalidateSubmissionsCache()` / `invalidateLecturerCache()`.
- Gemini key ada di client (`EXPO_PUBLIC_`) — untuk production pertimbangkan Appwrite Function.
- Spesifikasi lengkap: `dokumen_spesifikasi_teknis_lengkap_spsm_v2_1.md` (meski bernama v2.1, isinya sudah Blueprint v2.2).
