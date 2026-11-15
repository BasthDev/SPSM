import { AppHeader, Section } from '@/components';
import { Colors } from '@/theme/theme';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  HelpCircle,
  MessageCircle,
  User,
  XCircle,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AccordionItemProps = {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
};

const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  subtitle,
  icon,
  iconBgColor,
  children,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Section style={styles.accordionSection}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={styles.accordionHeader}
      >
        <View style={styles.accordionHeaderLeft}>
          <View style={[styles.iconBox, { backgroundColor: iconBgColor }]}>
            {icon}
          </View>
          <View style={styles.accordionHeaderText}>
            <Text style={styles.accordionTitle}>{title}</Text>
            {subtitle && <Text style={styles.accordionSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        {expanded ? (
          <ChevronUp size={20} color={Colors.textTertiary} strokeWidth={2} />
        ) : (
          <ChevronDown size={20} color={Colors.textTertiary} strokeWidth={2} />
        )}
      </TouchableOpacity>
      {expanded && <View style={styles.accordionContent}>{children}</View>}
    </Section>
  );
};

type QAItemProps = {
  question: string;
  answer: string;
};

const QAItem: React.FC<QAItemProps> = ({ question, answer }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.qaItem}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={styles.qaHeader}
      >
        <View style={styles.qaHeaderLeft}>
          <View style={styles.qaIconBox}>
            <MessageCircle size={16} color={Colors.primary} strokeWidth={2} />
          </View>
          <Text style={styles.qaQuestion}>{question}</Text>
        </View>
        {expanded ? (
          <ChevronUp size={18} color={Colors.textTertiary} strokeWidth={2} />
        ) : (
          <ChevronDown size={18} color={Colors.textTertiary} strokeWidth={2} />
        )}
      </TouchableOpacity>
      {expanded && (
        <View style={styles.qaAnswer}>
          <Text style={styles.qaAnswerText}>{answer}</Text>
        </View>
      )}
    </View>
  );
};

export default function PanduanScreen() {
  const [activeTab, setActiveTab] = useState<'guide' | 'qa'>('guide');

  const tabs = [
    { id: 'guide' as const, label: 'Panduan', icon: BookOpen },
    { id: 'qa' as const, label: 'Q&A', icon: MessageCircle },
  ];

  const faqData = [
    {
      question: 'Berapa lama proses review pengajuan?',
      answer: 'Proses review oleh Dosen Penilai biasanya memakan waktu 1-3 hari kerja. Setelah itu, pengesahan oleh Kaprodi memerlukan waktu tambahan 1-2 hari kerja.',
    },
    {
      question: 'Bagaimana cara melihat status pengajuan?',
      answer: 'Anda dapat melihat status pengajuan di halaman Dashboard atau dengan mengklik kartu pengajuan di bagian Riwayat Pengajuan.',
    },
    {
      question: 'Apa yang harus dilakukan jika diminta revisi?',
      answer: 'Periksa catatan revisi per judul dari Dosen Penilai di halaman detail, lalu tekan "Ajukan Ulang dengan Data Sama" — seluruh data (judul, latar belakang, jurnal, tabel relevansi, calon pembimbing) otomatis terisi dan tinggal diperbaiki sesuai catatan.',
    },
    {
      question: 'Bagaimana cara mengajukan ulang setelah ditolak?',
      answer: 'Tekan tombol "Ajukan Ulang dengan Data Sama" pada kartu pengajuan di dashboard atau di halaman detail. Form akan terisi otomatis dari data sebelumnya — Anda tinggal perbaiki lalu kirim ulang. Status revisi/ditolak memberi hak akses pengajuan kapan saja meski masa pengajuan ditutup.',
    },
    {
      question: 'Apa itu cek kemiripan judul otomatis?',
      answer: 'Saat submit, sistem membandingkan judul Anda dengan semua pengajuan aktif menggunakan kecocokan teks dan kecerdasan buatan (AI). Judul yang sangat mirip/sudah ada akan membatalkan pengajuan; yang mirip sebagian hanya menampilkan peringatan.',
    },
    {
      question: 'Di mana saya upload file skripsi yang sudah jadi?',
      answer: 'Bukan di halaman Skripsi Ku — upload dilakukan dari halaman detail pengajuan yang berstatus Disetujui. Setelah upload, file otomatis muncul di Skripsi Ku dan Repository.',
    },
    {
      question: 'Bagaimana cara mengunduh SK resmi?',
      answer: 'Setelah pengajuan disetujui, Anda dapat mengunduh SK resmi dari halaman detail pengajuan dengan mengklik tombol "Unduh / Cetak Dokumen SK".',
    },
    {
      question: 'Apakah saya bisa mengajukan lebih dari satu judul?',
      answer: 'Ya, Anda dapat mengajukan beberapa opsi judul dalam satu pengajuan (jumlah ditentukan oleh admin, umumnya 3). Dosen Penilai akan memilih salah satu yang terbaik.',
    },
    {
      question: 'Bagaimana cara menghubungi Dosen Pembimbing?',
      answer: 'Informasi kontak Dosen Pembimbing dapat dilihat di halaman detail pengajuan setelah pengajuan disetujui.',
    },
    {
      question: 'Apakah ada batas waktu pengajuan?',
      answer: 'Ya, pengajuan hanya dapat dilakukan pada periode yang ditentukan oleh kampus. Periksa status periode di halaman Dashboard.',
    },
    {
      question: 'Format file apa yang bisa diupload di Skripsi Ku?',
      answer: 'Hanya file PDF yang didukung. File Word (.doc/.docx) tidak dapat diupload — konversi ke PDF terlebih dahulu sebelum upload.',
    },
    {
      question: 'Apakah mahasiswa lain bisa melihat file saya di Skripsi Ku?',
      answer: 'Tidak. Halaman Skripsi Ku hanya menampilkan file yang Anda upload. File Anda dapat dilihat semua orang melalui halaman Repository.',
    },
    {
      question: 'Bagaimana cara mencari file di Repository?',
      answer: 'Buka halaman Repository dari menu dashboard, lalu ketik nama file pada kolom pencarian di bagian atas daftar file.',
    },
    {
      question: 'Bagaimana cara membaca file skripsi di aplikasi?',
      answer: 'Tap kartu file pada halaman Skripsi Ku atau Repository. Dokumen akan tampil di viewer — tekan ikon fullscreen untuk membaca dengan layar penuh.',
    },
  ];

  return (
    <View style={styles.container}>
      <AppHeader title="Panduan & Bantuan" showBack />

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <IconComponent
                size={18}
                color={isActive ? '#FFFFFF' : Colors.textSecondary}
                strokeWidth={2}
              />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'guide' ? (
          <>
            {/* Introduction */}
            <AccordionItem
              title="Tentang Aplikasi SPSM-KU"
              subtitle="Sarana Pengajuan Judul Skripsi Mahasiswa"
              icon={<BookOpen size={22} color={Colors.primary} strokeWidth={2} />}
              iconBgColor="#EFF6FF"
              defaultExpanded={true}
            >
              <Text style={styles.sectionContent}>
                Aplikasi ini membantu mahasiswa mengajukan judul skripsi, memantau status pengajuan,
                dan menerima informasi pengesahan dari Dosen Penilai dan Kaprodi secara real-time.
              </Text>
              <Text style={styles.sectionContent}>
                Fitur utama meliputi: pengajuan judul dengan cek kemiripan otomatis,
                tracking status, pilihan calon pembimbing, notifikasi,
                unduh dokumen SK, upload & baca file skripsi, dan repository file.
              </Text>
            </AccordionItem>

            {/* Skripsi Ku & Repository */}
            <AccordionItem
              title="Skripsi Ku & Repository"
              subtitle="Upload, baca, dan cari file skripsi"
              icon={<FileText size={22} color={Colors.primary} strokeWidth={2} />}
              iconBgColor="#EFF6FF"
            >
              <Text style={styles.stepTitle}>Skripsi Ku (File Saya)</Text>
              <View style={styles.tipList}>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Upload file skripsi Anda — hanya format PDF yang didukung
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    File tersimpan aman di cloud dan hanya Anda yang bisa melihatnya di halaman ini
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Tap kartu file untuk membacanya langsung di aplikasi — dokumen tampil di viewer
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Tekan tombol fullscreen (ikon persegi) untuk membaca lebih nyaman, lalu tekan &ldquo;Kecilkan&rdquo; untuk kembali
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    File bisa diunduh atau dibuka di browser dengan tombol di bawah viewer
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Hapus file kapan saja dengan ikon trash pada kartu file
                  </Text>
                </View>
              </View>
              <Text style={[styles.stepTitle, { marginTop: 16 }]}>Repository (Semua File)</Text>
              <View style={styles.tipList}>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Menampilkan semua file skripsi yang diupload oleh seluruh mahasiswa
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Gunakan kolom pencarian untuk mencari file berdasarkan nama
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Tap file untuk membacanya — sama seperti di Skripsi Ku
                  </Text>
                </View>
              </View>
            </AccordionItem>

            {/* Cara Pengajuan Pertama */}
            <AccordionItem
              title="Cara Pengajuan Pertama"
              subtitle="Langkah-langkah mengajukan judul skripsi"
              icon={<FileText size={22} color="#059669" strokeWidth={2} />}
              iconBgColor="#ECFDF5"
            >
              <View style={styles.stepList}>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Login ke Akun Anda</Text>
                    <Text style={styles.stepDesc}>
                      Masuk menggunakan akun Google atau kredensial yang diberikan oleh kampus.
                    </Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Klik &ldquo;Ajukan Judul Skripsi&rdquo;</Text>
                    <Text style={styles.stepDesc}>
                      Pada dashboard, klik tombol hero untuk memulai pengajuan baru.
                    </Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Isi Data Diri & Pilih Prodi</Text>
                    <Text style={styles.stepDesc}>
                      Lengkapi data mahasiswa dan pilih program studi yang sesuai.
                    </Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>4</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Susun Opsi-opsi Judul + Tabel Relevansi</Text>
                    <Text style={styles.stepDesc}>
                      Tulis usulan judul (jumlah sesuai pengaturan admin, umumnya 3) beserta latar belakang, jurnal acuan (judul, penulis,
                      tahun terbit), dan tabel relevansi penelitian (variabel, metodologi, kesesuaian).
                    </Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>5</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Pilih 2 Calon Dosen Pembimbing</Text>
                    <Text style={styles.stepDesc}>
                      Pilih dosen prioritas 1 dan 2 sebagai referensi awal bagi Reviewer
                      dan Kaprodi dalam menetapkan pembimbing.
                    </Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>6</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Submit Pengajuan</Text>
                    <Text style={styles.stepDesc}>
                      Sistem otomatis memeriksa kemiripan judul Anda dengan pengajuan lain.
                      Jika ada judul yang sangat mirip, pengajuan akan dibatalkan; jika mirip
                      sebagian, Anda bisa memilih untuk tetap mengajukan atau memperbaiki.
                      Setelah lolos, Anda akan menerima nomor dokumen.
                    </Text>
                  </View>
                </View>
              </View>
            </AccordionItem>

            {/* Cek Kemiripan Judul */}
            <AccordionItem
              title="Cek Kemiripan Judul Otomatis"
              subtitle="Sistem mencegah judul duplikat & mirip"
              icon={<AlertTriangle size={22} color="#7C3AED" strokeWidth={2} />}
              iconBgColor="#F5F3FF"
            >
              <Text style={styles.sectionContent}>
                Saat Anda menekan Kirim Pengajuan, sistem memeriksa seluruh judul Anda terhadap
                seluruh pengajuan yang masih aktif di kampus — secara teks (judul identik
                atau hampir sama) dan menggunakan kecerdasan buatan untuk menilai kemiripan topik.
              </Text>
              <View style={styles.tipList}>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    <Text style={styles.boldText}>Sangat mirip / sudah ada:</Text> pengajuan dibatalkan
                    dan ditampilkan judul yang menjadi kemiripan — perbaiki lalu ajukan kembali
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    <Text style={styles.boldText}>Mirip sebagian:</Text> muncul peringatan kuning —
                    Anda bisa &ldquo;Tetap Ajukan&rdquo; atau &ldquo;Kembali & Perbaiki&rdquo;
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Judul pada pengajuan yang sudah ditolak/diminta revisi tidak ikut dicek,
                    jadi Anda aman mengajukan ulang judul yang sama
                  </Text>
                </View>
              </View>
            </AccordionItem>

            {/* Status Pengajuan */}
            <AccordionItem
              title="Status Pengajuan"
              subtitle="Arti dan arti dari setiap status"
              icon={<Clock size={22} color="#D97706" strokeWidth={2} />}
              iconBgColor="#FEF3C7"
            >
              <View style={styles.statusList}>
                <View style={styles.statusItem}>
                  <View style={styles.statusIcon}>
                    <Clock size={18} color="#D97706" strokeWidth={2} />
                  </View>
                  <View style={styles.statusContent}>
                    <Text style={styles.statusTitle}>Menunggu Review</Text>
                    <Text style={styles.statusDesc}>
                      Pengajuan Anda sedang ditelaah oleh Dosen Penilai. Proses ini membutuhkan waktu 1-3 hari kerja.
                    </Text>
                  </View>
                </View>
                <View style={styles.statusItem}>
                  <View style={styles.statusIcon}>
                    <User size={18} color={Colors.primary} strokeWidth={2} />
                  </View>
                  <View style={styles.statusContent}>
                    <Text style={styles.statusTitle}>Menunggu Kaprodi</Text>
                    <Text style={styles.statusDesc}>
                      Judul sudah disetujui oleh Dosen Penilai dan menunggu pengesahan final dari Kaprodi.
                    </Text>
                  </View>
                </View>
                <View style={styles.statusItem}>
                  <View style={styles.statusIcon}>
                    <CheckCircle2 size={18} color="#059669" strokeWidth={2} />
                  </View>
                  <View style={styles.statusContent}>
                    <Text style={styles.statusTitle}>Disetujui</Text>
                    <Text style={styles.statusDesc}>
                      Pengajuan Anda telah resmi disahkan. Anda akan menerima SK resmi dan informasi Dosen Pembimbing.
                    </Text>
                  </View>
                </View>
                <View style={styles.statusItem}>
                  <View style={styles.statusIcon}>
                    <AlertTriangle size={18} color="#D97706" strokeWidth={2} />
                  </View>
                  <View style={styles.statusContent}>
                    <Text style={styles.statusTitle}>Perlu Revisi</Text>
                    <Text style={styles.statusDesc}>
                      Dosen Penilai meminta perbaikan pada usulan judul Anda. Silakan periksa catatan dan ajukan ulang.
                    </Text>
                  </View>
                </View>
                <View style={styles.statusItem}>
                  <View style={styles.statusIcon}>
                    <XCircle size={18} color={Colors.error} strokeWidth={2} />
                  </View>
                  <View style={styles.statusContent}>
                    <Text style={styles.statusTitle}>Ditolak</Text>
                    <Text style={styles.statusDesc}>
                      Usulan judul Anda tidak dapat diproses. Anda dapat membuat pengajuan baru dengan judul yang berbeda.
                    </Text>
                  </View>
                </View>
              </View>
            </AccordionItem>

            {/* Jika Diminta Revisi */}
            <AccordionItem
              title="Jika Diminta Revisi"
              subtitle="Langkah-langkah memperbaiki usulan judul"
              icon={<AlertTriangle size={22} color="#D97706" strokeWidth={2} />}
              iconBgColor="#FFFBEB"
            >
              <View style={styles.tipList}>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Periksa catatan revisi per judul dari Dosen Penilai di halaman detail pengajuan
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Tekan tombol <Text style={styles.boldText}>&ldquo;Ajukan Ulang dengan Data Sama&rdquo;</Text> —
                    judul, latar belakang, jurnal, tabel relevansi, dan calon pembimbing
                    otomatis terisi dari pengajuan sebelumnya
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Perbaiki bagian yang diminta revisi, lalu lanjutkan hingga kirim ulang
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Anda bisa mengajukan kapan saja — status revisi/ditolak memberikan hak akses khusus
                    meskipun masa pengajuan sedang ditutup
                  </Text>
                </View>
              </View>
            </AccordionItem>

            {/* Jika Ditolak */}
            <AccordionItem
              title="Jika Ditolak"
              subtitle="Langkah-langkah setelah pengajuan ditolak"
              icon={<XCircle size={22} color={Colors.error} strokeWidth={2} />}
              iconBgColor="#FEF2F2"
            >
              <View style={styles.tipList}>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Periksa alasan penolakan per judul di halaman detail pengajuan
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Tekan <Text style={styles.boldText}>&ldquo;Ajukan Ulang dengan Data Sama&rdquo;</Text> untuk
                    memulai dari data lama, atau mulai baru dari tombol Pengajuan Judul
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Buat judul yang lebih spesifik dan sesuai kebijakan akademik
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Konsultasikan dengan Dosen Pembimbing jika diperlukan
                  </Text>
                </View>
              </View>
            </AccordionItem>

            {/* Upload Skripsi Setelah Disetujui */}
            <AccordionItem
              title="Upload File Skripsi Setelah Disetujui"
              subtitle="Naskah akhir dari halaman detail pengajuan"
              icon={<FileText size={22} color="#059669" strokeWidth={2} />}
              iconBgColor="#ECFDF5"
            >
              <Text style={styles.sectionContent}>
                Setelah pengajuan judul Anda disahkan (status Disetujui), halaman detail
                pengajuan menampilkan form upload file skripsi — bukan di halaman Skripsi Ku.
              </Text>
              <View style={styles.tipList}>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Buka detail pengajuan yang berstatus Disetujui → scroll ke bagian Upload File Skripsi
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Pilih file PDF naskah akhir Anda — format lain akan ditolak
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    File otomatis terhubung ke pengajuan Anda dan muncul di halaman Skripsi Ku
                    serta Repository
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Anda bisa melihat, membuka, atau mengganti file kapan saja dari halaman detail
                  </Text>
                </View>
              </View>
            </AccordionItem>

            {/* Tips & Bantuan */}
            <AccordionItem
              title="Tips & Bantuan"
              subtitle="Saran untuk pengajuan yang berhasil"
              icon={<HelpCircle size={22} color="#7C3AED" strokeWidth={2} />}
              iconBgColor="#F5F3FF"
            >
              <View style={styles.tipList}>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Buat judul yang spesifik dan relevan dengan bidang studi Anda
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Sertakan jurnal referensi yang relevan dan terpercaya
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Tulis latar belakang yang jelas dan terstruktur
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Periksa kembali semua data sebelum submit
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Simpan nomor dokumen untuk referensi
                  </Text>
                </View>
              </View>
            </AccordionItem>
          </>
        ) : (
          <>
            {/* Q&A Section */}
            <Section style={styles.qaSection}>
              <View style={styles.sectionHeader}>
                <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                  <MessageCircle size={22} color={Colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Pertanyaan yang Sering Diajukan</Text>
                  <Text style={styles.sectionSubtitle}>
                    Jawaban untuk pertanyaan umum tentang aplikasi
                  </Text>
                </View>
              </View>
              <View style={styles.qaList}>
                {faqData.map((faq, index) => (
                  <QAItem key={index} question={faq.question} answer={faq.answer} />
                ))}
              </View>
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  accordionSection: {
    marginBottom: 12,
    padding: 0,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accordionHeaderText: {
    flex: 1,
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  accordionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  accordionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  sectionContent: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  stepList: {
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  statusList: {
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  tipList: {
    gap: 10,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  tipBullet: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
    lineHeight: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  qaSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  qaList: {
    gap: 8,
  },
  qaItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  qaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  qaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  qaIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
  qaAnswer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  qaAnswerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.text,
  },
});
