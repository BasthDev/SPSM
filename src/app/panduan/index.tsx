import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AppHeader, Section } from '@/components';
import { Colors } from '@/theme/theme';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  GraduationCap,
  User,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageCircle,
} from 'lucide-react-native';

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
      answer: 'Periksa catatan revisi dari Dosen Penilai di halaman detail pengajuan, perbaiki judul yang diminta, lalu klik "Ajukan Ulang" untuk mengirimkan revisi.',
    },
    {
      question: 'Bisakah saya mengajukan judul baru setelah ditolak?',
      answer: 'Ya, Anda dapat membuat pengajuan baru dengan judul yang berbeda. Pastikan judul baru tidak melanggar kebijakan akademik.',
    },
    {
      question: 'Bagaimana cara mengunduh SK resmi?',
      answer: 'Setelah pengajuan disetujui, Anda dapat mengunduh SK resmi dari halaman detail pengajuan dengan mengklik tombol "Unduh / Cetak Dokumen SK".',
    },
    {
      question: 'Apakah saya bisa mengajukan lebih dari satu judul?',
      answer: 'Ya, Anda dapat mengajukan 3 opsi judul dalam satu pengajuan. Dosen Penilai akan memilih salah satu yang terbaik.',
    },
    {
      question: 'Bagaimana cara menghubungi Dosen Pembimbing?',
      answer: 'Informasi kontak Dosen Pembimbing dapat dilihat di halaman detail pengajuan setelah pengajuan disetujui.',
    },
    {
      question: 'Apakah ada batas waktu pengajuan?',
      answer: 'Ya, pengajuan hanya dapat dilakukan pada periode yang ditentukan oleh kampus. Periksa status periode di halaman Dashboard.',
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
              subtitle="Sistem Pengajuan Judul Skripsi Mahasiswa"
              icon={<BookOpen size={22} color={Colors.primary} strokeWidth={2} />}
              iconBgColor="#EFF6FF"
              defaultExpanded={true}
            >
              <Text style={styles.sectionContent}>
                Aplikasi ini membantu mahasiswa mengajukan judul skripsi, memantau status pengajuan,
                dan menerima informasi pengesahan dari Dosen Penilai dan Kaprodi secara real-time.
              </Text>
              <Text style={styles.sectionContent}>
                Fitur utama meliputi: pengajuan judul, tracking status, notifikasi, dan unduh dokumen SK.
              </Text>
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
                    <Text style={styles.stepTitle}>Klik "Ajukan Judul Skripsi"</Text>
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
                    <Text style={styles.stepTitle}>Susun 3 Opsi Judul</Text>
                    <Text style={styles.stepDesc}>
                      Tulis 3 usulan judul skripsi beserta latar belakang, rumusan masalah, dan jurnal referensi.
                    </Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>5</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Submit Pengajuan</Text>
                    <Text style={styles.stepDesc}>
                      Periksa kembali semua data dan klik submit. Anda akan menerima nomor dokumen.
                    </Text>
                  </View>
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
                    Periksa catatan revisi dari Dosen Penilai di halaman detail pengajuan
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Perbaiki judul yang diminta revisi sesuai catatan
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Update latar belakang dan rumusan masalah jika diperlukan
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Klik "Ajukan Ulang" untuk mengirimkan revisi
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Tunggu review ulang dari Dosen Penilai
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
                    Periksa alasan penolakan di halaman detail pengajuan
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Buat pengajuan baru dengan judul yang lebih sesuai
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>
                    Pastikan judul tidak melanggar kebijakan akademik
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
});
