# Migrasi Appwrite → PocketBase — Implementation Plan

## 0. Evaluasi & Keputusan

| Kebutuhan | PocketBase | Catatan |
|---|---|---|
| Database + collections | ✅ | SQLite embedded, collections + fields via admin UI/API |
| Realtime | ✅ **Lebih baik** | Built-in SSE realtime → backend subscribe langsung, **tanpa delta-poller 15s** |
| OAuth Google | ✅ | `authWithOAuth2`, redirect `https://spsm.basthstudio.my.id/api/oauth2-redirect` |
| File storage | ✅ | Built-in file fields per collection |
| FCM push | ✅ unaffected | `firebase-admin` di backend, tidak bergantung DB |
| Auth user | ✅ | **Google OAuth saja** (sementara) — password migration tidak relevan |
| Migrasi file | ✅ | Download Appwrite → upload PB via API |

**Domain final:**

| Service | Domain |
|---|---|
| PocketBase (admin + API + OAuth) | `spsm.basthstudio.my.id` ← **PB mengambil alih domain Appwrite** |
| Backend API | `spsmapi.basthstudio.my.id` (tetap) |
| Appwrite | dimatikan setelah cutover (sementara bisa pindah ke subdomain lain kalau masih dibutuhkan) |

**Arsitektur baru:**

```
Mobile ──HTTPS/WS──> Backend (Express, JWT sendiri)
                          │ PocketBase JS SDK (server-side)
                          ├── UserDirectory abstraction (§4b — expandable)
                          ▼
                    PocketBase (single container)
                    ├── SQLite (data + auth users)
                    ├── Realtime SSE → backend bridge → WS fan-out
                    └── OAuth2 Google → redirect ke app scheme
```

---

## 1. Prasyarat & Setup PocketBase di VM

VM existing: `192.168.1.199` (VirtualBox), Docker tersedia, cloudflared tunnel `cff2b7ac-...` aktif.

```bash
# Di VM — PocketBase via Docker
docker run -d --name pocketbase --restart unless-stopped \
  -p 8090:8090 \
  -v ~/pocketbase/pb_data:/pb/pb_data \
  ghcr.io/muchobien/pocketbase:latest
```

### Cloudflare Tunnel — update `/etc/cloudflared/config.yml`

```yaml
ingress:
  - hostname: spsm.basthstudio.my.id     # PocketBase mengambil alih domain Appwrite
    service: http://localhost:8090
  - hostname: spsmapi.basthstudio.my.id  # Backend (tetap)
    service: http://localhost:5000
  - service: http_status:404
```

```bash
sudo systemctl restart cloudflared
```

**Cutover domain:** selama transisi, Appwrite bisa tetap diakses via `http://192.168.1.199` langsung (tanpa domain) untuk keperluan migrasi data. Setelah data pindah → `docker compose down` di `~/appwrite`.

---

## 2. Skema Database PocketBase

Buat collections via Admin UI (`https://spsm.basthstudio.my.id/_/`) atau API. Simpan `appwrite_id` di setiap record untuk mapping migrasi.

### Collections

| PB Collection | Field utama | Relasi |
|---|---|---|
| `users` (auth) | email, name, avatar, role, verified | — |
| `user_profiles` | user→users, nim, department→departments, batch_year→batch_years, phone | relasi |
| `lecturers` | user→users, nidn, name, role, department | relasi |
| `thesis_submissions` | student→users, title, abstract, status, period, files (proposal/revision/final) | relasi |
| `submission_options` | submission→thesis_submissions, option_type, title, description, file | relasi |
| `approval_logs` | submission→thesis_submissions, actor→users, action, note | relasi |
| `surat` | submission→thesis_submissions, nomor_surat, file, status | relasi |
| `departments` | code, name | — |
| `batch_years` | year, is_active | — |
| `system_settings` | key (unique), value (JSON), updated | — |

### Field types mapping

| Appwrite | PocketBase |
|---|---|
| string | `text` |
| integer/float | `number` |
| datetime | `date` |
| relationship | `relation` |
| file | `file` |
| array | `json` |
| `$id`/`$createdAt`/`$updatedAt` | `id`/`created`/`updated` (otomatis) |

---

## 3. Backend Adapter — `pocketbaseAdapter.ts`

Buat `server/src/database/pocketbaseAdapter.ts` implement `IDatabaseAdapter`, switch via env `DB_ADAPTER=pocketbase`.

```ts
import PocketBase from 'pocketbase';
const pb = new PocketBase(config.pocketbase.url); // https://spsm.basthstudio.my.id
pb.admins.authWithPassword(adminEmail, adminPassword); // server-side superuser
```

Dependency: `pocketbase` (JS SDK resmi).

### Mapping method

| IDatabaseAdapter | Implementasi PB |
|---|---|
| `listDocuments` | `getList`/`getFullList` + `filter` (translate `Query.equal` → `f = 'v'`, `orderDesc` → `sort: '-updated'`) |
| `getDocument` | `getOne(id)` |
| `createDocument` | `create(data)` |
| `updateDocument` | `update(id, data)` |
| `deleteDocument` | `delete(id)` |
| `listRecentDocuments` | **dihapus** — diganti PB realtime (§5) |

---

## 4. Auth — Google OAuth via PocketBase

### Flow

```
Mobile → backend /api/auth/oauth-url → dapat URL:
  https://spsm.basthstudio.my.id/api/oauth2-redirect
    ?provider=google&redirect=<app-scheme>... 
Mobile buka URL di browser → Google consent → PB redirect ke app scheme
  beserta ?code=<oauth_code>
App → backend /api/auth/oauth-exchange { code }
Backend → PB authWithOAuth2('google', { code }) → dapat PB user
Backend → resolveUserData (profile/role) → terbitkan JWT sendiri
```

**Catatan penting:** PB OAuth butuh `code` verifier — PocketBase JS SDK punya `authWithOAuth2Code(provider, code, codeVerifier, redirectUrl)`. Backend perlu simpan `codeVerifier` sementara (per login attempt) atau gunakan flow `authWithOAuth2` yang mengembalikan auth URL + menyimpan state. Detail implementasi disesuaikan SDK version saat coding.

### Mobile changes

| File | Perubahan |
|---|---|
| `authService.ts` | `createGoogleToken` → URL backend `/api/auth/oauth-url` (bukan langsung Appwrite) |
| `app.json` scheme | `appwrite-callback-6af9...` → `spsm://` (sudah ada di scheme list) atau `pocketbase-callback` |
| `login.tsx` | SUCCESS/FAILURE URL → scheme baru |
| `+native-intent.ts` | route `auth/success` tetap, tambah parsing `code` |

### Google Cloud Console

Redirect URI baru: `https://spsm.basthstudio.my.id/api/oauth2-redirect`

---

## 4b. Expandability — External User API (rencana integrasi server lain)

User menyebut akan ada **API eksternal untuk fetch user dari database server lain** yang diintegrasikan ke app. Desain sekarang agar mudah ditambah:

### Abstraksi `UserDirectory`

```ts
// server/src/services/userDirectory.ts
export interface UserDirectoryProvider {
  name: string;
  findByEmail(email: string): Promise<ExternalUser | null>;
  findById(id: string): Promise<ExternalUser | null>;
  syncUser?(user: ExternalUser): Promise<void>; // opsional: mirror ke PB
}

export interface ExternalUser {
  id: string; email: string; name: string;
  role?: string; metadata?: Record<string, unknown>;
}
```

Implementasi:
- `PocketBaseDirectory` — query `users` auth collection + `user_profiles`
- `ExternalApiDirectory` (nanti) — `fetch(${EXTERNAL_API_URL}/users?email=...)` dengan API key
- `CompositeDirectory` — coba external dulu → fallback PB, atau sebaliknya (config `USER_SOURCE_ORDER=external,pocketbase`)

### Integrasi di auth flow

`authService.resolveUserData()` diperluas:

```ts
// sekarang: hanya PB profile/lecturer
// nanti: userDirectory.findByEmail(email) → merge profile dari external API
//        → role/department/batch_year bisa datang dari server eksternal
```

### Yang disiapkan SEKARANG (tanpa implementasi eksternal)

1. `userDirectory.ts` interface + `PocketBaseDirectory` implementasi
2. `resolveUserData` pakai directory, bukan query langsung
3. Field `external_id` opsional di `user_profiles` untuk mapping user eksternal
4. Env config: `USER_SOURCE_ORDER`, `EXTERNAL_API_URL`, `EXTERNAL_API_KEY` (placeholder)
5. Dokumentasi di plan ini — saat API eksternal siap, tinggal tambah provider + set env

---

## 5. Realtime — Upgrade Poller → PB Realtime

```ts
// realtimeBridge.ts (revisi)
import PocketBase from 'pocketbase';
const pb = new PocketBase(config.pocketbase.url);

pb.collection('thesis_submissions').subscribe('*', (e) => {
  broadcast({ type: 'entity', collection: 'thesis_submissions', action: e.action, id: e.record.id, ... });
});
// idem: submission_options, approval_logs, surat, system_settings, users
```

- `e.action`: `create|update|delete` → delete detection gratis
- Hapus `listRecentDocuments` + watermark poller
- Fan-out per-user di `realtimeBridge` tidak berubah
- Mobile `realtimeService.ts` **tidak berubah**

---

## 6. File Storage Migration

```ts
const buf = await fetch(`${appwriteEndpoint}/storage/buckets/${bucket}/files/${fileId}/view?project=${pid}`)
  .then(r => r.arrayBuffer());
pb.collection('thesis_submissions').update(subId, { proposal_file: new File([buf], name) });
```

- Script one-time `server/scripts/migrate-appwrite-to-pb.ts`, idempotent by `appwrite_id`

---

## 7. Migration Script — Data

1. **Auth users** Appwrite → PB `users` (email, name; Google OAuth akan re-link by email)
2. Master data: `departments`, `batch_years`, `lecturers`
3. `user_profiles`, `thesis_submissions`, `submission_options`, `approval_logs`, `surat`, `system_settings`
4. Files (§6)
5. **Verifikasi**: row count per collection + sample diff

Mapping `appwrite_id` → PB `id` disimpan per record; relasi ditulis ulang dengan PB id.

---

## 8. Infra Changes

- `docker-compose` backend: tambah service `pocketbase` (atau container terpisah)
- `.env`: `DB_ADAPTER=pocketbase`, `POCKETBASE_URL`, `POCKETBASE_ADMIN_*`, `USER_SOURCE_ORDER`, `EXTERNAL_API_*` (placeholder)
- Hapus `APPWRITE_*` setelah cutover
- Google Console: redirect URI → `https://spsm.basthstudio.my.id/api/oauth2-redirect`

---

## 9. Rollout

1. Setup PB container + tunnel domain `spsm.basthstudio.my.id` (§1)
2. Collections + adapter + `userDirectory` abstraction (§2–4b)
3. Migration script dry-run → execute (§6–7)
4. Mobile OAuth update (§4) + rebuild dev client
5. UAT paralel: PB source of truth, Appwrite read-only via IP langsung
6. Cutover: matikan `~/appwrite` stack, update env final
7. Cleanup

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| OAuth `codeVerifier` flow PB | Ikuti SDK docs persis; simpan verifier di memory/Redis per attempt |
| Relasi ID berubah | `appwrite_id` + rewrite relasi saat insert |
| PB SQLite single file | Backup `pb_data` harian + snapshot Proxmox |
| PB realtime butuh auth | Backend pakai superuser subscribe; client tetap via WS |
| External API nanti | `UserDirectory` abstraction sudah disiapkan (§4b) |
| Domain cutover downtime | Setup PB dulu di IP, verify, baru pindah tunnel — downtime <1 menit |

## 11. Estimasi Scope

- `pocketbaseAdapter.ts`: ~400–600 LOC
- `userDirectory.ts` + refactor `authService`: ~150 LOC
- Migration script: ~300–400 LOC
- `realtimeBridge` revisi: ~100 LOC (hapus poller, tambah subscribe)
- Mobile: ~40 LOC
- Infra: compose + tunnel + env

---

## Status Implementasi (selesai)

- PocketBase jalan di `spsm.basthstudio.my.id` (container `pocketbase`, port 8090)
- Superuser: `admin@spsm.local` (ganti password di `/_/`)
- 9 collections dibuat via `server/scripts/setup-pocketbase.mjs`
- `server/src/database/pocketbaseAdapter.ts` — implementasi `IDatabaseAdapter`, switch via `DB_ADAPTER=pocketbase`
- `server/src/services/userDirectory.ts` — PocketBaseDirectory + ExternalApiDirectory (env `EXTERNAL_USER_API_URL`, `EXTERNAL_USER_API_KEY`, `USER_SOURCE_ORDER`)
- `server/src/services/realtimeBridge.ts` — PB SSE subscribe (fallback poller Appwrite)
- OAuth flow baru: `POST /api/auth/oauth/start` → `{url,key}`, `GET /api/auth/oauth/status?key=` → token+user. Mobile polling, tanpa deep link.
- Migrasi data: `server/scripts/migrate-appwrite-to-pocketbase.mjs` + `fix-fks.mjs` (dump postgres → JSONL di `scripts/.awdump/`)
- Google provider dikonfigurasi via API; redirect URI wajib: `https://spsm.basthstudio.my.id/api/oauth2-redirect`
- Appwrite containers sudah `compose down` (volume masih ada sebagai cadangan)
- Catatan: Node 20 butuh polyfill `eventsource` (sudah di `src/index.ts`)
