This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Backend & API Architecture Rules

- **No Direct Database Calls**: Mobile app (`src/`) dan Web app (`web_app/`, `web/`) TIDAK diperbolehkan mengimpor atau memanggil SDK database (Appwrite, Supabase, Postgres) secara langsung.
- **Universal API Layer**: Semua komunikasi data harus melalui `apiClient` yang terhubung ke Backend API Server (`server/`).
- **Layering Standard**:
  - `controllers/`: HTTP parsing, status code, format response standar.
  - `validators/`: Validasi payload dan validasi AI (Gemini similarity checker) sebelum pemrosesan bisnis.
  - `services/`: Alur logika bisnis dan orkestrasi.
  - `database/`: Universal Database Adapter (`IDatabaseAdapter`). Migrasi database hanya boleh memodifikasi adapter ini tanpa mengubah UI maupun layer lainnya.

## Server Access (Windows → Linux Remote)

SSH ke server remote dari Windows PowerShell **selalu** menggunakan:
```powershell
powershell -Command "ssh -o StrictHostKeyChecking=no -p 2222 basth@localhost '<perintah>'"
```
- **JANGAN** pakai `sshpass` (tidak tersedia di Windows)
- **JANGAN** pakai `&&` sebagai separator di PowerShell — gunakan `;`
- Untuk pencarian file/text di PowerShell, gunakan `Select-String` atau Python one-liner
- Password server: `@Maulidia05`

## Security Rules (Backend)

- **CORS**: Selalu pakai whitelist domain eksplisit via env var `CORS_ORIGINS`. **JANGAN** `app.use(cors())` tanpa opsi di production.
  ```ts
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());
  ```
- **JWT Secret**: Wajib throw error saat startup jika `JWT_SECRET` tidak di-set di production. Jangan ada fallback default.
- **Rate Limiter AI**: Setiap endpoint yang memanggil external AI API (Gemini dll) wajib pakai `similarityLimiter` (strict rate limit).
- **PocketBase URL field**: Jangan kirim string kosong `''` ke field bertipe URL — PocketBase akan mengembalikan 400. Skip update atau kirim `null`.

## Realtime WebSocket Rules

- Saat menerima event `auth_error` dari WebSocket/SSE server, **jangan reconnect**. Set `intentionalClose = true` sebelum `socket.close()`. Redirect user ke halaman login.
- Auto-reconnect hanya untuk disconnect tidak disengaja (`code !== 1000` dan bukan `intentionalClose`).

## Building APK on Server (Self-hosted Mini-EAS)

Server runs a self-hosted APK builder at `https://apk.basthstudio.my.id` (deployed on `Nyx-Server` 192.168.18.194).

**Workflow:**
1. Push changes to GitHub `main` branch (icon, config, code changes, etc.)
2. Open https://apk.basthstudio.my.id — realtime UI shows build progress (stepper, live log, elapsed time)
3. Click "Build APK Sekarang" — builder will:
   - `git pull` latest main
   - `npm install` (if needed)
   - `npx expo prebuild --platform android` (always, no --clean — fresh native config)
   - `./gradlew assembleRelease`
   - Auto-sign unsigned APK with debug keystore
4. Wait ~10-20 minutes (first build downloads SDK; subsequent builds faster)
5. When status becomes "SUCCESS", download APK via tombol "Download APK Terbaru"

**API (optional):**
- `GET /status.json` — JSON build status
- `GET /log` — live build log
- `GET /download` — latest APK
- `POST /build?token=spsm-build-2026` — trigger build

**Server setup:**
- Repo clone: `/home/basth/apbuilder` (auto-pulls on build)
- APK output: `/home/basth/apk-dist/latest.apk`
- Service: `spsm-apk-builder` (systemd, auto-restart)
- Cloudflare Tunnel: `apk.basthstudio.my.id` → `localhost:8085`
- Builder files: `deploy/apk-builder/` (build-apk.sh, apk_builder.py, systemd unit)

