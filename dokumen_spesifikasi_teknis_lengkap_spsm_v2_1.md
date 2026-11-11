# 📘 Spesifikasi Teknis & Blueprint Lengkap: SPSM v2.2 (Standardized & Dynamic)

**(Sarana Pengajuan Skripsi Mahasiswa)**

Dokumen ini merupakan spesifikasi perangkat lunak (*Software Requirement Specification*) dan panduan arsitektur sistem SPSM versi pembaruan. Sistem ini mendigitalkan pengajuan proposal/judul skripsi, dari tahap inisiasi mahasiswa hingga penerbitan Surat Keputusan (SK) berlapis sistem otomatisasi dan proses administrasi *offline*. Seluruh parameter validasi (termasuk jumlah judul yang wajib diajukan) sepenuhnya dinamis dan dikendalikan oleh Admin.

## 1. Tumpukan Teknologi (Tech Stack)

* **Mobile App (Mahasiswa)**: Expo React Native, React Navigation, NativeWind (TailwindCSS untuk RN).
* **Web Dashboard (Reviewer, Kaprodi, TU, Admin)**: React JS (Vite), TailwindCSS, React Router.
* **Backend & Database**: Appwrite (Auth OAuth2, Databases - NoSQL Document, Storage, Functions).
* **Automasi Dokumen**: Appwrite Functions (Node.js) untuk *generate* PDF Template & Nomor Surat.

## 2. Aktor & Manajemen Hak Akses (Role Management)

Sistem membedakan akses dan *dashboard* berdasarkan peran (`role`), merujuk pada standar hierarki akademik kampus:

1. **Mahasiswa (`student`)**: Bertugas melengkapi profil, mengajukan $N$ opsi judul (jumlah diatur admin) beserta matriks/tabel relevansi, merevisi penolakan, dan mengunduh SK.
2. **Dosen Reviewer / Komisi Pembimbing (`lecturer`)**: Mengevaluasi seluruh usulan judul, memberikan catatan revisi, menolak/menerima usulan, dan **merekomendasikan/menetapkan 2 Dosen Pembimbing** awal.
3. **Ketua Program Studi (`kaprodi`)**: Melakukan validasi akhir (Pleno). Memeriksa hasil *screening* reviewer, mengecek similaritas/plagiasi judul alumni, menetapkan pembimbing final, dan mengesahkan judul.
4. **Akademik / Tata Usaha Fakultas (`akademik`)**: Mengunduh *template* draf SK terautomasi, mencetak fisik, mengurus administrasi TTD Dekan (offline), dan mengunggah kembali *scan* PDF SK resmi ber-TTD basah.
5. **Admin (`admin`)**: Mengontrol konfigurasi sistem secara dinamis (jadwal buka/tutup, batas minimal SKS, daftar matkul prasyarat, dan kuota jumlah judul yang wajib diajukan).

## 3. Alur Sistem & Siklus Hidup Pengajuan (State Management)

Siklus ini mewakili alur SOP akademik yang paling umum diterapkan di berbagai universitas.

1. **`drafting`**:
   * *Kondisi*: Mahasiswa menyusun usulan. Sistem menarik data dari `system_settings` untuk memvalidasi jadwal, kelayakan SKS, dan merender form input sebanyak $N$ judul sesuai aturan admin.

2. **`pending_lecturer` (Screening Tahap 1)**:
   * *Kondisi*: Data di-*submit*. Masuk ke antrean Reviewer/Komisi Pembimbing. Form mahasiswa terkunci (View Only).

3. **`rejected` / `revision` (Dikembalikan)**:
   * *Kondisi*: Reviewer menolak usulan. Seluruh opsi judul memiliki catatan spesifik (misal: "Metode pada Judul 1 tidak tepat, Judul 2 plagiasi").
   * *Aksi Khusus*: Mahasiswa mendapat akses *bypass* untuk merevisi dan mengirim ulang tanpa terblokir sistem penjadwalan *closing* admin.

4. **`waiting_kaprodi` (Screening Tahap 2 / Pleno)**:
   * *Kondisi*: Reviewer telah meng-ACC 1 judul terbaik dan memplot calon pembimbing. Menunggu ketuk palu / penetapan dari Kaprodi.

5. **`waiting_akademik` (Tahap Administrasi)**:
   * *Kondisi*: Kaprodi telah mengesahkan (*Approve*).
   * *Automasi Backend*: Fungsi `generate_nomor_surat` berjalan seketika. Nomor Surat resmi dan No. Dokumen (Barcode/Hash) digenerate dan disuntikkan ke *template* draf SK.

6. **`sk_process` (Proses Pengesahan Dekan)**:
   * *Kondisi*: TU menekan tombol "Proses TTD", mencetak draf, dan meminta tanda tangan Dekan secara *offline*. Status mahasiswa: *"SK Sedang Diproses"*.

7. **`sk_issued` (Finalisasi)**:
   * *Kondisi*: TU mengunggah file Scan PDF SK ber-TTD basah. Tombol **"Download SK"** terbuka untuk mahasiswa. Proses bimbingan resmi dapat dimulai.

## 4. Arsitektur Struktural Aplikasi Mobile (React Native)

Menerapkan **Clean Architecture** (Service Layer Pattern) agar UI terpisah dari logika pengambilan data dinamis.

### Struktur Folder (`src/`)

```text
src/
├── app/                  # Expo Router: File-based routing (index.js, (auth)/, (tabs)/)
├── assets/               # Gambar, Icon, Animasi Lottie
├── components/           # UI Reusable (Dumb Components)
│   ├── form/             # RelevanceTableInput, FileUploader
│   └── layout/           # DynamicConfigBanner (Peringatan jadwal/SKS)
├── screens/              # Logic presentasi UI (Smart Components)
│   ├── OnboardingScreen  # Form kelengkapan data awal (NIM, Prodi)
│   ├── SubmissionForm    # Form usulan judul (Merender iterasi form sebanyak N kali)
│   └── SubmissionDetail  # Menampilkan catatan revisi & Tombol Download SK
├── services/             # SERVICE LAYER: Pusat Komunikasi dengan Backend
│   ├── configService.js  # Fetch system_settings (Date, Min SKS, Jumlah Judul)
│   └── submissionService.js # Submit data, Upload File ke Storage
└── utils/                # Helper functions
```

## 5. Skema Relasi Database (Entity-Relationship)

Menggunakan Appwrite Databases (`spsm_db`).

### Peta Relasi (ERD Abstraksi)

```text
[system_settings] (Konfigurasi Global Dinamis - 1 Baris)

[users] 1 ----- M [thesis_submissions] 1 ----- N [submission_options]
(Data Diri)       (Header Pengajuan)             (Detail N Alternatif)
                          |
                          | 1
                          |
                          1 [surat]
                            (Data Dokumen, Nomor Urut, File SK Final)
```

### Spesifikasi Tabel (Collections)

#### 1. `system_settings` (Pengaturan Admin & Validator)
| Atribut | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `is_active` | Boolean | True jika buka, False jika tutup |
| `start_date` / `end_date` | Datetime | Rentang waktu pengajuan aktif |
| `min_sks` | Integer | Syarat minimum kelulusan SKS |
| `required_title_count` | Integer | **Dinamis:** Jumlah usulan judul yang WAJIB diajukan mahasiswa (Cth: 2, 3, atau 4) |
| `required_courses` | String[] | Array matkul wajib (Cth: `["Metodologi Penelitian"]`) |

#### 2. `users` (Profil Autentikasi)
| Atribut | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `user_id` | String | (PK) Appwrite Auth ID |
| `name` | String | Nama lengkap mahasiswa / staf |
| `role` | String | `student`, `lecturer`, `kaprodi`, `akademik`, `admin` |
| `nim_or_nip` | String | Identitas akademik kampus |

#### 3. `thesis_submissions` (Header Induk Pengajuan)
| Atribut | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `$id` | String | (PK) Document ID |
| `student_id` | String | (FK) Relasi ke `users.user_id` |
| `advisor_1_id` | String | (FK) Dosen Pembimbing 1 (Utama) |
| `advisor_2_id` | String | (FK) Dosen Pembimbing 2 (Pendamping) |
| `status` | String | Enum status alur kerja (Cth: `pending_lecturer`) |

#### 4. `submission_options` (Rincian N Judul)
| Atribut | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `submission_id` | String | (FK) Relasi ke `thesis_submissions.$id` |
| `option_number` | Integer | (Iterasi ke-1 hingga $N$) |
| `title` | String | Judul Usulan |
| `relevance_table` | Text | JSON String data (Fokus, Metode, Kesesuaian Jurnal) |
| `journal_file_id` | String | ID File PDF Referensi (Opsional) |
| `lecturer_notes` | Text | Catatan perbaikan dari dosen |
| `is_selected` | Boolean | *True* jika ini adalah judul yang di-ACC Kaprodi |

#### 5. `surat` (Manajemen Dokumen Final SK)
| Atribut | Tipe | Deskripsi |
| :--- | :--- | :--- |
| `submission_id` | String | (FK) Relasi ke pengajuan terkait |
| `nomor_surat` | String | Format: `URUTAN/SPSM/PRODI/ANGKATAN/TAHUN` |
| `urutan` | Integer | Auto-increment berdasarkan SK tahun berjalan |
| `no_dokumen` | String | Hash Identifier (Cth: `SPSM-6AF2DC41...`) |
| `template_sk_id` | String | File ID Draf SK *Auto-generated* |
| `scanned_sk_id` | String | File ID Scan SK ber-TTD basah (Diunduh Mahasiswa) |

## 6. Automasi Inti (Appwrite Functions)

Sistem menggunakan *Serverless Function* (Node.js) untuk proses administratif kritikal:

**Trigger:** `databases.documents.update` (Jika status di tabel `thesis_submissions` berubah menjadi `waiting_akademik`).
**Proses Logika:**
1. Mencari *record* terakhir di tabel `surat` pada tahun akademik berjalan untuk mendapatkan `urutan` tertinggi, lalu ditambah 1.
2. Merangkai format string `nomor_surat` baku dan meng-generate hash unik `no_dokumen`.
3. Menulis baris baru ke tabel `surat`.
4. Menyuntikkan data tersebut ke sebuah template dokumen PDF untuk dicetak staf TU.

## 7. Keamanan Akses (Security & Permissions)

Menggunakan fitur **Document-Level Security (DLS)** standar industri:
* Dokumen `thesis_submissions` dan rincian opsinya hanya bisa diakses (Read) oleh pemilik (`student_id` terkait) dan tim yang memiliki *role* spesifik.
* Mahasiswa sama sekali tidak memiliki izin akses (Write/Update) ke kolom `status` atau `is_selected` untuk mencegah manipulasi persetujuan di sisi *client*.