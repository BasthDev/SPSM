# Rencana: API Layer Abstraksi (Anti-Appwrite-Lock-in)

Tujuan: semua pemanggilan database dibungkus dalam **satu API layer** dengan endpoint semantik (`getSubmission(id)`, `getSuratBySubmission(id)`), sehingga migrasi ke database lain nanti cukup ganti **satu file adapter**, bukan ubah semua halaman.

---

## 1. Masalah Sekarang

Saat ini ketiga app memanggil Appwrite SDK langsung di banyak tempat:

- Mobile: `submissionService`, `settingsService`, `authService`, `academicService` → `databases.listDocuments(...)` tersebar
- `web/`: pola sama dengan web SDK
- `web_app`: `spsm.js` langsung `databases.*` + `storage.*`

Konsekuensi: pindah DB = rewrite semua service + semua halaman yang import Appwrite types (`$id`, `$createdAt`, dll).

## 2. Arsitektur yang Diusulkan

```
┌─────────────────────────────────────────────┐
│  UI / Pages (tidak tahu Appwrite sama sekali)│
│  dashboard.tsx, reviewer.js, AdminView.tsx   │
└──────────────────┬──────────────────────────┘
                   │ import { api } from '...'
┌──────────────────▼──────────────────────────┐
│  API Layer (src/services/api.ts / api.js)    │
│  api.submissions.getById(id)                 │
│  api.surat.getBySubmissionId(subId)          │
│  api.logs.listBySubmissionId(subId)          │
│  → return DTO netral (bukan Appwrite Document)│
└──────────────────┬──────────────────────────┘
                   │ SATU-SATUNYA yang tahu Appwrite
┌──────────────────▼──────────────────────────┐
│  DataSource Adapter                          │
│  appwriteAdapter.ts  ← implementasi sekarang │
│  (nanti: restAdapter.ts / prismaAdapter.ts)  │
└─────────────────────────────────────────────┘
```

### Aturan Emas

1. **UI hanya boleh import `api`** — tidak boleh import `databases`, `Query`, `ID`, atau `storage` langsung.
2. **Return value = DTO polos** — mapping `$id`→`id`, `$createdAt`→`createdAt` dilakukan di adapter. UI tidak bergantung pada field internal Appwrite.
3. **Satu file adapter per backend** — `appwriteAdapter.ts` hari ini; ganti backend = tulis adapter baru + ganti 1 baris di `api.ts`.
4. Service lama (`submissionService` dll) **tetap ada sebagai facade** — di dalamnya delegasi ke `api`, jadi halaman tidak perlu diubah sekaligus.

## 3. Daftar Endpoint API (kontrak)

Semua method async, return `Promise<T | null>` atau `Promise<T[]>`. Error dilempar sebagai `ApiError` dengan `message` Bahasa Indonesia.

### submissions
| Method | Return | Appwrite mapping (saat ini) |
|---|---|---|
| `api.submissions.listByStudent(studentId)` | `SubmissionDto[]` | `thesis_submissions` where `student_id`, order `submitted_at` desc |
| `api.submissions.getById(id)` | `SubmissionDto \| null` | `getDocument` |
| `api.submissions.listAll({status?, advisorId?})` | `SubmissionDto[]` | `thesis_submissions` + filter client |
| `api.submissions.create({studentId, options, prefAdv1, prefAdv2})` | `SubmissionDto` | create doc + N options + log |
| `api.submissions.updateStatus(id, status, patch?)` | `void` | `updateDocument` |
| `api.submissions.getComparableTitles()` | `{title, submissionId}[]` | options join status exclude revision/rejected |

### options (judul)
| Method | Return |
|---|---|
| `api.options.listBySubmission(submissionId)` | `OptionDto[]` (ordered by `option_number`) |
| `api.options.upsertMany(submissionId, options[])` | untuk resubmit/revisi |

### surat
| Method | Return | Catatan |
|---|---|---|
| `api.surat.getBySubmissionId(submissionId)` | `SuratDto \| null` | **ganti query `surat` by `submission_id`** |
| `api.surat.upsert(submissionId, data)` | `SuratDto` | generate nomor SK |

### logs
| `api.logs.listBySubmissionId(submissionId)` | `LogDto[]` ordered `created_at` asc |
| `api.logs.create({submissionId, actorId, action, notes})` | `void` |

### users / profile
| `api.users.getProfile(userId)` | `UserProfileDto` |
| `api.users.markThesisUploaded(userId)` | `void` |
| `api.users.list()` | untuk admin |

### lecturers
| `api.lecturers.list({activeOnly?})` | `LecturerDto[]` |
| `api.lecturers.getById(id)` / `getByNip(nip)` | |
| `api.lecturers.create/update/delete` | admin |

### master data
| `api.departments.list()`, `api.batchYears.list()` | + CRUD admin |

### settings
| `api.settings.get()` | `SystemSettingsDto` |
| `api.settings.update(settings)` | |

### files (storage)
| `api.files.upload({bucket:'journals'|'sk', file, ownerId})` | `{fileId, viewUrl}` |
| `api.files.getViewUrl(fileId)` / `getDownloadUrl(fileId)` | |
| `api.files.list({ownerId?})` | untuk repo |

### auth
| `api.auth.getCurrentUser()` | `{account, profile, role, isAdmin}` |
| `api.auth.loginGoogle()`, `loginEmail()`, `logout()` | |

## 4. DTO (bentuk data yang UI terima)

```ts
// Contoh — field datar, tanpa $ prefix, tanpa tipe Appwrite
interface SubmissionDto {
  id: string;
  studentId: string;
  status: SubmissionStatus;
  submittedAt: string;
  advisor1Id?: string;
  advisor2Id?: string;
  preferredAdvisor1Id?: string;
  preferredAdvisor2Id?: string;
  // hydrated opsional (diisi service, bukan adapter)
  options?: OptionDto[];
  logs?: LogDto[];
  student?: UserProfileDto | null;
  advisor1?: LecturerDto | null;
  advisor2?: LecturerDto | null;
  surat?: SuratDto | null;
}
```

> Catatan: hydration (gabung options+logs+student+surat) tetap di **service layer**, bukan adapter — adapter hanya 1:1 dengan tabel.

## 5. Rencana Implementasi Bertahap

### Fase 1 — Mobile (`src/services/api/`)
1. Buat `src/services/api/types.ts` — semua DTO di atas
2. Buat `src/services/api/appwriteAdapter.ts` — implementasi `DataSource` interface memanggil `databases`/`storage` yang sudah ada
3. Buat `src/services/api/index.ts` — `export const api = createApi(appwriteAdapter)` + tipe `Api`
4. Refactor `submissionService` dkk menjadi facade: method publik tetap sama, internal panggil `api.*`
5. `npx tsc --noEmit` + `npx expo lint` tiap langkah

### Fase 2 — web_app (`src/js/api.js`)
1. `api.js` dengan bentuk sama (vanilla JS, JSDoc types)
2. `appwriteAdapter` di dalamnya memakai `databases` dari `appwrite.js`
3. `spsm.js` method existing → delegasi ke `api` (cache memoization tetap di service, bukan adapter)
4. `npm run build`

### Fase 3 — web/ (`web/src/services/api/`)
Sama seperti Fase 1, web SDK.

### Fase 4 — Migrasi DB (contoh ke REST/Supabase)
Tulis `restAdapter.ts` implement `DataSource`, ganti 1 baris di `api/index.ts`. **Tidak ada halaman yang diubah.**

## 6. Risiko & Catatan

- **Jangan big-bang rewrite** — facade pattern membuat refactor incremental & aman.
- Field Appwrite `$id`/`$createdAt` masih dipakai internal adapter; DTO mapping dilakukan di boundary.
- `web_app` cache (`_subsCache`) tetap di service layer — adapter harus stateless.
- Query kompleks (mis. `getComparableTitles` butuh join status↔options) boleh tetap di service: adapter sediakan `listOptions()` + `listSubmissions()` mentah, service yang menggabung.
- Estimasi: Fase 1-3 murni refactor tanpa ubah perilaku; tiap fase diverifikasi typecheck/build.

## 7. File yang Akan Dibuat/Diubah

**Baru:**
- `src/services/api/{types,appwriteAdapter,index}.ts` (mobile)
- `web_app/src/js/api.js`
- `web/src/services/api/{types,appwriteAdapter,index}.ts`

**Diubah (facade internals saja):**
- `src/services/{submissionService,settingsService,authService,academicService}.ts`
- `web_app/src/js/spsm.js`
- `web/src/services/*.ts`

**Tidak diubah:** semua file `app/`, komponen, dan halaman — itulah tujuannya.
