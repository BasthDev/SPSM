# 📘 Spesifikasi Pembaruan & Logika Sistem: SPSM (Sarana Pengajuan Skripsi Mahasiswa) v2.0

Dokumen ini merangkum seluruh pembaruan aturan bisnis (*business rules*), struktur data, serta alur interaksi antara Aplikasi Mobile Mahasiswa (Expo RN), Website Dosen/Kaprodi, dan Panel Admin.

---

## 1. Manajemen Masa Pengajuan oleh Admin (Date Range & Status)

Admin memiliki kontrol penuh atas kapan mahasiswa dapat melakukan pengajuan proposal judul skripsi melalui panel administrasi web.

### **Atribut Pengaturan Admin (`system_settings`):**
*   `is_active` (Boolean): Status global apakah pengajuan sedang dibuka (`true`) atau ditutup (`false`).
*   `start_date` (Datetime): Tanggal dan waktu mulai masa pengajuan.
*   `end_date` (Datetime): Tanggal dan waktu berakhir masa pengajuan.
*   `academic_year` (String): Tahun ajaran aktif (contoh: `2025/2026 Ganjil`).

### **Validasi di Aplikasi Mobile Mahasiswa:**
1. Saat mahasiswa membuka halaman form pengajuan, aplikasi melakukan *fetch* data dari koleksi `system_settings`.
2. **Kondisi Normal (Pengajuan Pertama):** 
   * Jika `is_active == false` atau tanggal hari ini berada di luar rentang `start_date` hingga `end_date`, tombol *Submit* akan dinonaktifkan (*disabled*) dan muncul informasi banner: *"Masa pengajuan judul skripsi belum dibuka atau telah berakhir."*
3. **Pengecualian Khusus (Re-submission / Revisi / Tolak):**
   * Jika status pengajuan mahasiswa sebelumnya adalah **`revision`** atau **`rejected`**, mahasiswa **tetap diizinkan** membuat pengajuan baru meskipun masa pengajuan oleh admin sedang ditutup (`is_active == false` atau di luar tanggal). Sistem memberikan hak akses khusus berdasarkan riwayat status mahasiswa tersebut.

---

## 2. Pembaruan Form Pengajuan Mahasiswa (Mobile Expo RN)

Pada halaman pembuatan pengajuan (3 Opsi Judul), terdapat penambahan elemen penting agar proposal lebih terstruktur:

### **A. Pemilihan Dua Dosen Pembimbing Pilihan**
* Mahasiswa diminta memilih **2 calon Dosen Pembimbing** (Prioritas 1 dan Prioritas 2) dari daftar dropdown dosen yang aktif di program studi. Ini menjadi referensi awal bagi reviewer.

### **B. Tabel Relevansi di Bawah Kolom Referensi**
Tepat di bawah informasi jurnal referensi pada setiap opsi judul, ditambahkan komponen **Tabel Relevansi** ringkas untuk mengukur kecocokan penelitian. Kolom dalam tabel relevansi meliputi:
1. **Variabel / Fokus Penelitian** (Apa yang diteliti)
2. **Metodologi Jurnal** (Metode yang digunakan referensi)
3. **Kesesuaian / Relevansi dengan Topik Mahasiswa** (Penjelasan singkat mengapa jurnal ini relevan)

---

## 3. Logika Reviewer & Penolakan/Revisi (Website Dosen)

Ketika Dosen Reviewer memeriksa pengajuan mahasiswa:

### **A. Pengaturan Dua Dosen Pembimbing**
* Dosen Reviewer memiliki hak penuh untuk menetapkan atau mengubah **kedua Dosen Pembimbing** (Pembimbing 1 dan Pembimbing 2) yang akan mendampingi mahasiswa hingga lulus, terlepas dari pilihan awal yang diajukan mahasiswa.
* Ketua Program Studi (**Kaprodi**) juga memiliki hak akses yang sama untuk melihat dan mengubah kedua dosen pembimbing tersebut kapan saja, bahkan setelah diatur oleh reviewer.

### **B. Logika Penolakan / Revisi Total (Reject)**
* Jika Dosen Reviewer menekan tombol **Tolak / Revisi**, maka **ketiga opsi judul yang diajukan mahasiswa akan otomatis ditandai sebagai ditolak/perlu revisi**.
* Sistem menghasilkan catatan terstruktur untuk setiap judul. Contoh format pesan yang masuk ke database dan tampil di aplikasi mobile:
  * `Judul 1: Perlu revisi pada rumusan masalah dan batasan variabel.`
  * `Judul 2: Topik sudah pernah diteliti pada tahun 2024, silakan ganti studi kasus.`
  * `Judul 3: Metodologi kurang relevan dengan bidang keahlian prodi.`
* Ketiga opsi yang berstatus ditolak beserta catatan spesifiknya akan langsung tampil secara transparan di aplikasi mobile mahasiswa.

---

## 4. Agregasi Data & Kalkulasi Total Pengajuan (Backend Logic)

Untuk keperluan laporan rekapitulasi di dashboard admin dan kaprodi, backend melakukan filter khusus pada data pengajuan:

* **Aturan Kalkulasi Total (`total_verified_submissions`):**
  * Backend **hanya menghitung** total pengajuan yang telah melewati verifikasi reviewer / berstatus sah (`verified`, `waiting_kaprodi`, atau `approved`) setelah total tersebut dihitung sama dengan total yang akan masuk ke kaprodi, barulah data akan dikirim sekaligus ke kaprodi.
  * **Pengecualian:** Pengajuan dengan status **`rejected`** atau **`revision`** **dikeluarkan (exclude)** dari total hitung pengajuan aktif mahasiswa, sehingga metrik statistik akurat hanya mencerminkan proposal yang valid dan sedang diproses/lolos.

---

## 5. Ringkasan Alur Status Pengajuan (State Machine)

1. **`drafting`**: Mahasiswa mengisi form 3 opsi, tabel relevansi, dan 2 pilihan dosen pembimbing.
2. **`pending_lecturer`**: Dikirim ke Dosen Reviewer (Tunduk pada validasi tanggal aktif admin, kecuali status sebelumnya dikirim/ditolak/revisi).
3. **`rejected` / `revision`**: Dosen menolak/meminta revisi. Ke-3 opsi memuat catatan spesifik. Mahasiswa dapat mengajukan ulang kapan saja.
4. **`waiting_kaprodi`**: Dosen telah memilih 1 judul terbaik dan menetapkan 2 dosen pembimbing final.
5. **`approved`**: Disahkan oleh Kaprodi. Judul dan kedua dosen pembimbing resmi sah di aplikasi mahasiswa.



Nomor Surat:
- Nomor surat akan di generate otomatis oleh backend
- Format nomor surat: URUTAN/SPSM/PRODI/ANGKATAN/TAHUN
- URUTAN akan di generate otomatis berdasarkan jumlah pengajuan yang sudah di approve
- URUTAN akan di reset setiap tahun
- URUTAN akan di increment setiap kali pengajuan yang sudah di approve
- URUTAN akan di simpan di database
- URUTAN akan di tampilkan di aplikasi mobile mahasiswa
- URUTAN akan di tampilkan di aplikasi web reviewer
- URUTAN akan di tampilkan di aplikasi web kaprodi
- URUTAN akan di tampilkan di aplikasi web admin
- URUTAN akan di tampilkan di aplikasi web dosen
- URUTAN akan di tampilkan di aplikasi web mahasiswa
- URUTAN akan di tampilkan di aplikasi web guest
- URUTAN akan di tampilkan di aplikasi web public

contoh : 01/SPSM/BD/23/2026


juga untuk NO. DOKUMEN: SPSM-6AF2DC410034D8AC2BDA
di mobile detail/id dan di web ahrus menggunan 1 data yang sama

lalu saat approve oleh kaprodi, maka nomor surat akan di generate otomatis, serta di simpan dalam database di tabel surat dengan relasi ke pengajuan user, jadi nanti sudah verid, di mobile mahasiswa akan muncul tombol download sk, nanti juga aku akan buatkan sk template yang akan di download oleh mahasiswa, untuk sekarang bisa kita simpan di adlam database sebagai file pdf/word