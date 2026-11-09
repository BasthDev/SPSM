# 📚 Blueprint & Arsitektur Sistem: SPSM (Sarana Pengajuan Skripsi Mahasiswa)

Aplikasi **SPSM (Sarana Pengajuan Skripsi Mahasiswa)** dirancang untuk mendigitalkan dan menyederhanakan alur pengajuan judul skripsi hingga penentuan Dosen Pembimbing secara terintegrasi. Sistem ini menggunakan **Expo React Native** (Mobile untuk Mahasiswa), **Website Dashboard** (untuk Dosen & Kaprodi), serta **Appwrite** sebagai BaaS (*Backend-as-a-Service*) yang menangani Auth, Database, dan Storage.

---

## 1. Spesifikasi Autentikasi & Onboarding Mahasiswa (Google OAuth)

Untuk memberikan pengalaman pengguna yang cepat dan minim hambatan, autentikasi mahasiswa menggunakan akun Google institusi/pribadi.

### **Alur Autentikasi & Onboarding:**
1. **Login dengan Google:** 
   * Mahasiswa membuka aplikasi Expo RN dan menekan tombol *"Masuk dengan Google"*.
   * Aplikasi memicu `account.createOAuth2Session()` dari Appwrite SDK.
   * Setelah sukses melakukan otorisasi via browser/redirect, Appwrite menghasilkan sesi aktif.
2. **Pengecekan Profil di Database:**
   * Aplikasi mengecek apakah `user_id` yang sedang login sudah terdaftar di koleksi `users`.
   * **Jika belum (Pengguna Baru):** Aplikasi mengarahkan mahasiswa ke **Layar Onboarding** untuk melengkapi data akademik wajib.
   * **Jika sudah (Pengguna Lama):** Mahasiswa langsung diarahkan ke **Dashboard Utama**.
3. **Data Onboarding Mahasiswa:**
   * **NIM** (Nomor Induk Mahasiswa - *String, Unique*)
   * **Nama Asli** (Sinkron dari Google atau diinput manual - *String*)
   * **Program Studi / Prodi** (Dropdown - *String*)
   * **Angkatan / Tahun Masuk** (Integer)
   * **Nomor WhatsApp** (Opsional untuk notifikasi - *String*)

---

## 2. Arsitektur *Service Layer* (Expo React Native)

Untuk menjaga kode tetap bersih (*clean code*), mudah diuji (*testable*), dan terstruktur, kita menerapkan **Service Layer Pattern**. Pola ini memisahkan logika komunikasi backend (Appwrite) dari komponen UI (React Native).

### **Struktur Folder yang Disarankan:**
```text
src/
├── app/                  # Expo Router / Navigation
├── components/           # UI Reusable Components
├── screens/              # Halaman Aplikasi (UI)
├── services/             # <-- SERVICE LAYER (Pusat Logika API)
│   ├── appwrite.js       # Inisialisasi Client Appwrite
│   ├── authService.js    # Logika Auth & Onboarding User
│   └── submissionService.js # Logika Pengajuan & Opsi Judul
├── models/               # TypeScript Interfaces / Tipe Data
└── utils/                # Helper & Constants
```

### **Contoh Implementasi Service Layer:**

#### **A. Konfigurasi Appwrite (`src/services/appwrite.js`)**
```javascript
import { Client, Account, Databases, Storage } from 'appwrite';

export const client = new Client();

client
    .setEndpoint('https://cloud.appwrite.io/v1') // Ganti dengan endpoint Appwrite kamu
    .setProjectId('ID_PROJECT_KAMU');           // Ganti dengan Project ID kamu

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
```

#### **B. Auth & Onboarding Service (`src/services/authService.js`)**
```javascript
import { account, databases } from './appwrite';
import { ID, Query } from 'appwrite';

const DATABASE_ID = 'spsm_db';
const COLLECTION_USERS = 'users';

export const authService = {
    // Login dengan Google OAuth
    async loginWithGoogle() {
        try {
            // Membuka OAuth web session
            return account.createOAuth2Session('google', 'spsm://', 'spsm://');
        } catch (error) {
            throw new Error(`Gagal login Google: ${error.message}`);
        }
    },

    // Cek apakah profil user sudah lengkap di database
    async getUserProfile(userId) {
        try {
            const response = await databases.listDocuments(
                DATABASE_ID,
                COLLECTION_USERS,
                [Query.equal('user_id', userId)]
            );
            return response.documents.length > 0 ? response.documents[0] : null;
        } catch (error) {
            throw new Error(`Gagal mengambil profil: ${error.message}`);
        }
    },

    // Menyimpan data onboarding mahasiswa baru
    async completeOnboarding(userId, data) {
        try {
            return await databases.createDocument(
                DATABASE_ID,
                COLLECTION_USERS,
                ID.unique(),
                {
                    user_id: userId,
                    name: data.name,
                    email: data.email,
                    role: 'student',
                    nim_or_nip: data.nim,
                    department: data.department,
                    batch_year: parseInt(data.batchYear),
                    created_at: new Date().toISOString()
                }
            );
        } catch (error) {
            throw new Error(`Gagal menyimpan data onboarding: ${error.message}`);
        }
    }
};
```

#### **C. Submission Service (`src/services/submissionService.js`)**
```javascript
import { databases, storage } from './appwrite';
import { ID } from 'appwrite';

const DATABASE_ID = 'spsm_db';
const COLLECTION_SUBMISSIONS = 'thesis_submissions';
const COLLECTION_OPTIONS = 'submission_options';
const BUCKET_JOURNALS = 'journal_files';

export const submissionService = {
    // Mengirim pengajuan judul baru beserta 3 opsi
    async createSubmission(studentId, optionsData) {
        try {
            // 1. Buat Header Pengajuan Utama
            const submission = await databases.createDocument(
                DATABASE_ID,
                COLLECTION_SUBMISSIONS,
                ID.unique(),
                {
                    student_id: studentId,
                    status: 'pending_lecturer',
                    submitted_at: new Date().toISOString()
                }
            );

            // 2. Loop dan buat 3 opsi judul
            for (const option of optionsData) {
                let fileId = null;

                // Jika ada file PDF jurnal opsional yang diunggah
                if (option.pdfFile) {
                    const uploadedFile = await storage.createFile(
                        BUCKET_JOURNALS,
                        ID.unique(),
                        option.pdfFile
                    );
                    fileId = uploadedFile.$id;
                }

                await databases.createDocument(
                    DATABASE_ID,
                    COLLECTION_OPTIONS,
                    ID.unique(),
                    {
                        submission_id: submission.$id,
                        option_number: option.number,
                        title: option.title,
                        background: option.background,
                        journal_title: option.journalTitle || '',
                        journal_author: option.journalAuthor || '',
                        journal_file_id: fileId,
                        is_selected_by_lecturer: false
                    }
                );
            }

            return submission;
        } catch (error) {
            throw new Error(`Gagal mengirim pengajuan: ${error.message}`);
        }
    }
};
```

---

## 3. Alur Kerja Sistem (End-to-End Workflow)

1. **Tahap 1: Mahasiswa (Expo RN)**
   * Mahasiswa login pakai Gmail $\rightarrow$ Mengisi NIM & Nama di Onboarding $\rightarrow$ Mengisi form 3 opsi judul & file PDF jurnal (opsional) $\rightarrow$ *Submit*.
2. **Tahap 2: Dosen Reviewer (Website)**
   * Dosen melihat daftar pengajuan $\rightarrow$ Membaca opsi judul dan file pendukung $\rightarrow$ **Mencentang 1 Judul Terbaik** $\rightarrow$ **Menentukan Dosen Pembimbing** untuk mahasiswa tersebut $\rightarrow$ Meneruskan ke Kaprodi.
3. **Tahap 3: Kaprodi (Website)**
   * Kaprodi memverifikasi hasil review dosen $\rightarrow$ Menekan tombol **Sahkan (Approve)**.
4. **Tahap 4: Hasil Akhir (Expo RN)**
   * Berkat fitur *Realtime* Appwrite, aplikasi mahasiswa otomatis memperbarui status menjadi **Disetujui** dan langsung menampilkan **Judul Skripsi Sah** beserta **Nama Dosen Pembimbing**.

---

## 4. Struktur Database & Metadata Appwrite

### **Koleksi 1: `users`**
* `user_id` (String) - ID dari Appwrite Auth
* `name` (String) - Nama lengkap asli
* `email` (String) - Email Google
* `role` (String) - `student`, `lecturer`, `kaprodi`, `admin`
* `nim_or_nip` (String) - NIM mahasiswa atau NIP dosen
* `department` (String) - Program Studi
* `batch_year` (Integer) - Tahun angkatan

### **Koleksi 2: `thesis_submissions`**
* `student_id` (String) - Relasi ke user mahasiswa
* `advisor_id` (String, *Nullable*) - ID Dosen Pembimbing hasil plotting dosen
* `status` (String) - `pending_lecturer`, `waiting_kaprodi`, `approved`, `revision`, `rejected`
* `submitted_at` (Datetime)

### **Koleksi 3: `submission_options`**
* `submission_id` (String) - Relasi ke `thesis_submissions`
* `option_number` (Integer) - Nilai `1`, `2`, atau `3`
* `title` (String) - Teks judul
* `background` (Text) - Latar belakang masalah
* `journal_title` (String, *Nullable*) - Judul jurnal referensi
* `journal_author` (String, *Nullable*) - Penulis jurnal
* `journal_file_id` (String, *Nullable*) - ID file PDF di Appwrite Storage
* `is_selected_by_lecturer` (Boolean) - `true` jika dicentang dosen

### **Koleksi 4: `approval_logs`**
* `submission_id` (String)
* `actor_id` (String) - ID Dosen / Kaprodi yang bertindak
* `action` (String) - `select_title_and_advisor`, `kaprodi_approve`
* `notes` (String, *Nullable*)
* `created_at` (Datetime)