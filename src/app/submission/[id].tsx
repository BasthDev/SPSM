import {
  AppHeader,
  Avatar,
  Button,
  LoadingScreen,
  Section,
  StatusBadge,
} from '@/components';
import type { ThesisSubmission } from '@/models/types';
import { submissionService } from '@/services/submissionService';
import { Colors } from '@/theme/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  XCircle,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function SubmissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<ThesisSubmission | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) {
        router.back();
        return;
      }
      try {
        const sub = await submissionService.getSubmissionWithDetails(id);
        if (!active) return;
        setSubmission(sub);
      } catch (e) {
        console.error('Failed to load submission details', e);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id, router]);

  if (loading) return <LoadingScreen message="Memuat detail pengajuan..." />;

  if (!submission) {
    return (
      <View style={styles.flex}>
        <AppHeader title="Detail Pengajuan" showBack backHref="/dashboard" />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Data pengajuan tidak ditemukan.</Text>
          <Button
            title="Kembali ke Dashboard"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
            variant="secondary"
            style={{ marginTop: 16 }}
          />
        </View>
      </View>
    );
  }

  const formattedSubmittedDate = new Date(submission.submitted_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedApprovalDate = submission.kaprodiApprovalDate
    ? new Date(submission.kaprodiApprovalDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  // Progress Stage Calculation
  // 1: Pengajuan Masuk (pending_lecturer)
  // 2: Verifikasi Reviewer (waiting_kaprodi)
  // 3: Disahkan Kaprodi (approved)
  let currentStage = 1;
  if (submission.status === 'waiting_kaprodi') currentStage = 2;
  if (submission.status === 'approved') currentStage = 3;

  const selectedOption =
    submission.selectedOption ||
    submission.options?.find((o) => o.is_selected_by_lecturer) ||
    null;

  const otherOptions =
    submission.options?.filter((o) => o.$id !== selectedOption?.$id) || [];

  const handleOpenPdf = (fileId?: string | null) => {
    if (!fileId) return;
    const url = submissionService.getFileViewUrl(fileId);
    if (url) {
      Linking.openURL(url).catch((err) => console.warn('Cannot open URL', err));
    }
  };

  return (
    <View style={styles.flex}>
      <AppHeader title="Detail Pengajuan Skripsi" showBack backHref="/dashboard" />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
        {/* 1. STATUS PROGRESS TRACKER */}
        <Section style={styles.trackerCard}>
          <View style={styles.statusBadgeRow}>
            <Text style={styles.sectionHeading}>Alur Proses Pengajuan</Text>
            <StatusBadge status={submission.status} />
          </View>

          {/* Vertical Stepper Progress Timeline */}
          <View style={styles.verticalStepper}>
            {/* Step 1: Diajukan */}
            <View style={styles.vStepItem}>
              <View style={styles.vStepLeft}>
                <View style={[styles.vStepCircle, styles.vStepCircleCompleted]}>
                  <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.5} />
                </View>
                <View
                  style={[
                    styles.vStepLine,
                    (currentStage >= 2 || submission.status === 'revision' || submission.status === 'rejected') &&
                      styles.vStepLineActive,
                  ]}
                />
              </View>
              <View style={styles.vStepRight}>
                <View style={styles.vStepHeader}>
                  <Text style={styles.vStepTitle}>1. Pengajuan Usulan Judul</Text>
                  <View style={[styles.vStepBadge, styles.vBadgeSuccess]}>
                    <Text style={styles.vBadgeTextSuccess}>Selesai</Text>
                  </View>
                </View>
                <Text style={styles.vStepDesc}>
                  3 usulan judul dan latar belakang diajukan oleh Mahasiswa.
                </Text>
                <Text style={styles.vStepDate}>{formattedSubmittedDate}</Text>
              </View>
            </View>

            {/* Step 2: Review Dosen Penilai */}
            <View style={styles.vStepItem}>
              <View style={styles.vStepLeft}>
                <View
                  style={[
                    styles.vStepCircle,
                    currentStage >= 2 && styles.vStepCircleCompleted,
                    currentStage === 1 && submission.status === 'pending_lecturer' && styles.vStepCircleActive,
                    submission.status === 'revision' && styles.vStepCircleWarning,
                    submission.status === 'rejected' && styles.vStepCircleDanger,
                  ]}
                >
                  {currentStage >= 2 ? (
                    <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.5} />
                  ) : submission.status === 'revision' ? (
                    <AlertTriangle size={15} color="#FFFFFF" strokeWidth={2.5} />
                  ) : submission.status === 'rejected' ? (
                    <XCircle size={15} color="#FFFFFF" strokeWidth={2.5} />
                  ) : (
                    <Clock size={16} color={Colors.primary} strokeWidth={2.2} />
                  )}
                </View>
                <View
                  style={[
                    styles.vStepLine,
                    currentStage >= 3 && styles.vStepLineActive,
                  ]}
                />
              </View>
              <View style={styles.vStepRight}>
                <View style={styles.vStepHeader}>
                  <Text style={styles.vStepTitle}>2. Verifikasi Dosen Penilai</Text>
                  {submission.status === 'pending_lecturer' && (
                    <View style={[styles.vStepBadge, styles.vBadgeActive]}>
                      <Text style={styles.vBadgeTextActive}>Sedang Berlangsung</Text>
                    </View>
                  )}
                  {currentStage >= 2 && (
                    <View style={[styles.vStepBadge, styles.vBadgeSuccess]}>
                      <Text style={styles.vBadgeTextSuccess}>Terverifikasi</Text>
                    </View>
                  )}
                  {submission.status === 'revision' && (
                    <View style={[styles.vStepBadge, styles.vBadgeWarning]}>
                      <Text style={styles.vBadgeTextWarning}>Perlu Revisi</Text>
                    </View>
                  )}
                  {submission.status === 'rejected' && (
                    <View style={[styles.vStepBadge, styles.vBadgeDanger]}>
                      <Text style={styles.vBadgeTextDanger}>Ditolak</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.vStepDesc}>
                  {submission.status === 'pending_lecturer' &&
                    'Dosen Penilai sedang menelaah kelayakan judul dan menentukan calon Dosen Pembimbing.'}
                  {currentStage >= 2 &&
                    'Judul terpilih telah disepakati dan usulan calon Dosen Pembimbing telah direkomendasikan.'}
                  {submission.status === 'revision' &&
                    'Dosen Penilai meminta revisi usulan judul. Silakan periksa catatan dan ajukan ulang judul baru.'}
                  {submission.status === 'rejected' &&
                    'Usulan judul ditolak. Anda dapat membuat pengajuan baru di halaman Dashboard.'}
                </Text>
              </View>
            </View>

            {/* Step 3: Pengesahan Kaprodi */}
            <View style={[styles.vStepItem, styles.vStepItemLast]}>
              <View style={styles.vStepLeft}>
                <View
                  style={[
                    styles.vStepCircle,
                    currentStage >= 3 && styles.vStepCircleCompleted,
                    currentStage === 2 && styles.vStepCircleActive,
                    (submission.status === 'revision' || submission.status === 'rejected') &&
                      styles.vStepCircleInactive,
                  ]}
                >
                  {currentStage >= 3 ? (
                    <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.5} />
                  ) : currentStage === 2 ? (
                    <Award size={16} color={Colors.primary} strokeWidth={2.2} />
                  ) : (
                    <Award size={16} color={Colors.textTertiary} strokeWidth={2} />
                  )}
                </View>
              </View>
              <View style={styles.vStepRight}>
                <View style={styles.vStepHeader}>
                  <Text style={styles.vStepTitle}>3. Pengesahan SK Kaprodi</Text>
                  {submission.status === 'approved' && (
                    <View style={[styles.vStepBadge, styles.vBadgeSuccess]}>
                      <Text style={styles.vBadgeTextSuccess}>Resmi Disahkan</Text>
                    </View>
                  )}
                  {submission.status === 'waiting_kaprodi' && (
                    <View style={[styles.vStepBadge, styles.vBadgeActive]}>
                      <Text style={styles.vBadgeTextActive}>Menunggu Pengesahan</Text>
                    </View>
                  )}
                  {currentStage === 1 && (
                    <View style={[styles.vStepBadge, styles.vBadgeInactive]}>
                      <Text style={styles.vBadgeTextInactive}>Menunggu Review</Text>
                    </View>
                  )}
                  {(submission.status === 'revision' || submission.status === 'rejected') && (
                    <View style={[styles.vStepBadge, styles.vBadgeInactive]}>
                      <Text style={styles.vBadgeTextInactive}>Tidak Diproses</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.vStepDesc}>
                  {submission.status === 'approved' &&
                    `SK Pengesahan Judul resmi diterbitkan dan ditandatangani oleh ${submission.kaprodiName || 'Ketua Program Studi'}.`}
                  {submission.status === 'waiting_kaprodi' &&
                    'Menunggu validasi akhir dan penerbitan Surat Keputusan oleh Kaprodi.'}
                  {currentStage === 1 &&
                    'Pengesahan SK akan diproses setelah lolos verifikasi Dosen Penilai.'}
                  {(submission.status === 'revision' || submission.status === 'rejected') &&
                    'Tahap pengesahan ditiadakan karena pengajuan tidak berlanjut.'}
                </Text>
                {formattedApprovalDate ? (
                  <Text style={styles.vStepDate}>Disahkan: {formattedApprovalDate}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Status Explanation Banner */}
          <View style={styles.statusDescriptionBox}>
            <Text style={styles.statusDescriptionText}>
              {submission.status === 'pending_lecturer' &&
                'Pengajuan Anda sedang dalam antrean pemeriksaan oleh Dosen Penilai untuk penentuan judul terbaik dan calon pembimbing.'}
              {submission.status === 'waiting_kaprodi' &&
                'Dosen Penilai telah memilih usulan judul dan menentukan Dosen Pembimbing. Menunggu validasi & pengesahan final oleh Ketua Program Studi.'}
              {submission.status === 'approved' &&
                'Selamat! Pengajuan judul dan Dosen Pembimbing Anda telah resmi disahkan oleh Kaprodi.'}
              {submission.status === 'revision' &&
                'Usulan judul skripsi Anda perlu diperbaiki. Anda dapat mengajukan judul baru dari halaman Dashboard.'}
              {submission.status === 'rejected' &&
                'Usulan judul ini telah ditolak. Anda dapat membuat pengajuan baru melalui halaman Dashboard.'}
            </Text>
          </View>
        </Section>

        {/* 2. LEMBAR PENGESAHAN RESMI AKADEMIK (SERTIFIKAT SK RESMI KAPRODI) */}
        {submission.status === 'approved' && (
          <View style={styles.certFrameOuter}>
            <View style={styles.certFrameInner}>
              {/* Kop Surat Dokumen Resmi */}
              <View style={styles.certKopHeader}>
                <View style={styles.certEmblemBox}>
                  <GraduationCap size={24} color="#0A4C8F" strokeWidth={2.2} />
                </View>
                <Text style={styles.certKopInstansi}>
                  KEMENTERIAN PENDIDIKAN, KEBUDAYAAN, RISET, DAN TEKNOLOGI
                </Text>
                <Text style={styles.certKopUniv}>
                  SISTEM INFORMASI TUGAS AKHIR & SKRIPSI MAHASISWA
                </Text>
                <Text style={styles.certKopProdi}>
                  PROGRAM SARJANA STRATA SATU (S-1)
                </Text>

                {/* Garis Ganda Kop Surat Resmi Standar Indonesia */}
                <View style={styles.certKopDoubleLine}>
                  <View style={styles.certKopLineThick} />
                  <View style={styles.certKopLineThin} />
                </View>
              </View>

              {/* Judul Surat Keputusan */}
              <View style={styles.certTitleBlock}>
                <Text style={styles.certDocType}>SURAT KEPUTUSAN PENGESAHAN</Text>
                <Text style={styles.certDocSubject}>PENETAPAN JUDUL SKRIPSI & DOSEN PEMBIMBING</Text>
                <Text style={styles.certDocNumber}>
                  Nomor: SK-SPSM/{new Date(submission.submitted_at).getFullYear()}/{submission.$id.slice(-6).toUpperCase()}
                </Text>
              </View>

              {/* Kalimat Pengantar / Konsiderans Formal */}
              <Text style={styles.certPreamble}>
                Berdasarkan hasil verifikasi dan rapat penelaahan usulan tugas akhir, Ketua Program Studi dengan ini menerangkan dan mengesahkan usulan penelitian skripsi serta penetapan Dosen Pembimbing untuk:
              </Text>

              {/* Rincian Berkas Biodata & Usulan Terpilih */}
              <View style={styles.certDataGrid}>
                {selectedOption ? (
                  <View style={styles.certDataRow}>
                    <Text style={styles.certDataLabel}>Judul Skripsi Disahkan:</Text>
                    <Text style={styles.certDataValueTitle}>
                      &ldquo;{selectedOption.title}&rdquo;
                    </Text>
                  </View>
                ) : null}

                {submission.advisor ? (
                  <View style={styles.certDataRow}>
                    <Text style={styles.certDataLabel}>Dosen Pembimbing Utama:</Text>
                    <Text style={styles.certDataValueBold}>
                      {submission.advisor.name}
                    </Text>
                    <Text style={styles.certDataSubtext}>
                      NIP/NIDN: {submission.advisor.nip} · Keahlian: {submission.advisor.expertise || 'Umum'}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.certDataRow}>
                  <Text style={styles.certDataLabel}>Tanggal Resmi Pengesahan:</Text>
                  <Text style={styles.certDataValue}>
                    {formattedApprovalDate || formattedSubmittedDate}
                  </Text>
                </View>

                {submission.kaprodiNotes ? (
                  <View style={styles.certDataRow}>
                    <Text style={styles.certDataLabel}>Ketentuan / Catatan Kaprodi:</Text>
                    <Text style={styles.certDataNotes}>
                      {submission.kaprodiNotes}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Bagian Tanda Tangan & Cap Stempel Digital Resmi */}
              <View style={styles.certSignSection}>
                <View style={styles.certSignRightCol}>
                  <Text style={styles.certSignDate}>
                    Ditetapkan pada: {formattedApprovalDate || formattedSubmittedDate}
                  </Text>
                  <Text style={styles.certSignRole}>Ketua Program Studi,</Text>

                  {/* Stempel & Verifikasi Digital Elektronik */}
                  <View style={styles.certDigitalSealContainer}>
                    <View style={styles.certStampCircle}>
                      <ShieldCheck size={20} color="#059669" strokeWidth={2.4} />
                      <Text style={styles.certStampText}>DISAHKAN DIGITAL</Text>
                      <Text style={styles.certStampSub}>SPSM VALIDATED</Text>
                    </View>
                  </View>

                  <Text style={styles.certSignName}>
                    {submission.kaprodiName || 'Ketua Program Studi'}
                  </Text>
                  <Text style={styles.certSignNip}>
                    Pejabat Berwenang Pengesah SK
                  </Text>
                </View>
              </View>

              {/* Watermark / Footer Pengaman */}
              <View style={styles.certSecurityFooter}>
                <ShieldCheck size={13} color="#059669" strokeWidth={2.2} />
                <Text style={styles.certSecurityText}>
                  Dokumen ini telah disahkan secara elektronik melalui SPSM Cloud dan memiliki kekuatan hukum akademik resmi.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 3. DETAIL DOSEN PEMBIMBING (Disembunyikan jika status Ditolak atau Perlu Revisi) */}
        {submission.status !== 'revision' && submission.status !== 'rejected' && (
          submission.advisor ? (
            <Section style={styles.advisorSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.headerIconCircle}>
                  <GraduationCap size={20} color={Colors.primary} strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.sectionHeading}>Dosen Pembimbing Skripsi</Text>
                  <Text style={styles.sectionSubheading}>
                    {submission.status === 'approved'
                      ? 'Resmi ditetapkan sebagai Pembimbing Utama'
                      : 'Diusulkan oleh Reviewer (Menunggu Pengesahan)'}
                  </Text>
                </View>
              </View>

              <View style={styles.advisorCard}>
                <View style={styles.advisorTopRow}>
                  <Avatar
                    name={submission.advisor.name}
                    size={58}
                    backgroundColor={Colors.primary}
                  />
                  <View style={styles.advisorMainInfo}>
                    <Text style={styles.advisorName}>{submission.advisor.name}</Text>
                    <Text style={styles.advisorNip}>NIP / NIDN: {submission.advisor.nip}</Text>
                    <View style={styles.advisorProdiPill}>
                      <Text style={styles.advisorProdiText}>
                        Prodi: {submission.advisor.department_id}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.advisorDivider} />

                {/* Vertical Stack: Bidang & Keahlian, Email, Kuota Bimbingan */}
                <View style={styles.advisorMetaCol}>
                  <View style={styles.advisorFieldBlock}>
                    <Text style={styles.advisorFieldLabel}>Bidang Keahlian & Minat Riset:</Text>
                    <Text style={styles.advisorFieldValue}>
                      {submission.advisor.expertise || 'Umum'}
                    </Text>
                  </View>

                  <View style={styles.advisorFieldBlock}>
                    <Text style={styles.advisorFieldLabel}>Alamat Email Institusi:</Text>
                    <Text style={styles.advisorFieldValueMono}>
                      {submission.advisor.email}
                    </Text>
                  </View>

                  <View style={styles.advisorFieldBlock}>
                    <Text style={styles.advisorFieldLabel}>Status Kuota Bimbingan:</Text>
                    <Text style={styles.advisorQuotaValue}>
                      {submission.advisor.current_students || 0} / {submission.advisor.quota} Mahasiswa Terisi
                    </Text>
                  </View>
                </View>
              </View>
            </Section>
          ) : (
            <Section style={styles.advisorPendingSection}>
              <View style={styles.advisorPendingContent}>
                <Clock size={24} color={Colors.warning} strokeWidth={2.2} />
                <View style={styles.advisorPendingTexts}>
                  <Text style={styles.advisorPendingTitle}>Dosen Pembimbing Belum Ditetapkan</Text>
                  <Text style={styles.advisorPendingSubtitle}>
                    Tim Dosen Penilai sedang meninjau bidang keahlian yang paling relevan dengan opsi judul Anda.
                  </Text>
                </View>
              </View>
            </Section>
          )
        )}

        {/* 4. JUDUL SKRIPSI TERPILIH (Disahkan / Dipilih) */}
        {selectedOption ? (
          <Section style={styles.selectedTitleSection}>
            <View style={styles.selectedTitleHeader}>
              <View style={styles.selectedTitleBadge}>
                <CheckCircle2 size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.selectedTitleBadgeText}>
                  JUDUL TERPILIH (OPSI #{selectedOption.option_number})
                </Text>
              </View>
            </View>

            <Text style={styles.selectedTitleText}>{selectedOption.title}</Text>

            <View style={styles.selectedBgBox}>
              <Text style={styles.boxLabel}>Latar Belakang & Rumusan Masalah:</Text>
              <Text style={styles.boxText}>{selectedOption.background}</Text>
            </View>

            {selectedOption.journal_title ? (
              <View style={styles.journalBox}>
                <View style={styles.journalHeader}>
                  <BookOpen size={16} color={Colors.primary} strokeWidth={2} />
                  <Text style={styles.journalHeaderTitle}>Jurnal Referensi Pendukung</Text>
                </View>
                <Text style={styles.journalTitleText}>{selectedOption.journal_title}</Text>
                <Text style={styles.journalAuthorText}>
                  Penulis: {selectedOption.journal_author || '-'}
                </Text>

                {selectedOption.journal_file_id ? (
                  <TouchableOpacity
                    style={styles.btnPdf}
                    onPress={() => handleOpenPdf(selectedOption.journal_file_id)}
                    activeOpacity={0.8}
                  >
                    <ExternalLink size={14} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.btnPdfText}>Buka Dokumen PDF Jurnal</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </Section>
        ) : null}

        {/* 5. DAFTAR OPSI JUDUL (Jika belum ada yang dipilih, tampilkan semua) */}
        {!selectedOption && submission.options && submission.options.length > 0 ? (
          <View>
            <Text style={styles.listSectionHeading}>3 Usulan Judul Skripsi</Text>
            {submission.options.map((opt) => (
              <Section key={opt.$id} style={styles.optionCard}>
                <View style={styles.optionNumberBadge}>
                  <Text style={styles.optionNumberText}>Opsi #{opt.option_number}</Text>
                </View>

                <Text style={styles.optionTitleText}>{opt.title}</Text>
                <Text style={styles.optionBgText} numberOfLines={4}>
                  {opt.background}
                </Text>

                {opt.journal_title ? (
                  <View style={styles.journalSubBox}>
                    <Text style={styles.journalSubText}>
                      📖 Jurnal: {opt.journal_title} ({opt.journal_author})
                    </Text>
                  </View>
                ) : null}
              </Section>
            ))}
          </View>
        ) : null}

        {/* 6. USULAN ALTERNATIF LAINNYA (Jika ada judul terpilih) */}
        {selectedOption && otherOptions.length > 0 ? (
          <View style={styles.otherOptionsSection}>
            <Text style={styles.otherOptionsHeading}>Usulan Judul Alternatif Lainnya</Text>
            {otherOptions.map((opt) => (
              <Section key={opt.$id} style={styles.otherOptionCard}>
                <View style={styles.otherOptionHeader}>
                  <Text style={styles.otherOptionNumber}>Opsi #{opt.option_number}</Text>
                </View>
                <Text style={styles.otherOptionTitle}>{opt.title}</Text>
              </Section>
            ))}
          </View>
        ) : null}

        {/* 7. RIWAYAT LOG CATATAN & EVALUASI */}
        {submission.logs && submission.logs.length > 0 ? (
          <Section style={styles.logsSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#F1F5F9' }]}>
                <MessageSquare size={18} color={Colors.textSecondary} strokeWidth={2.2} />
              </View>
              <Text style={styles.sectionHeading}>Catatan & Jejak Penilaian</Text>
            </View>

            <View style={styles.logsList}>
              {submission.logs.map((log) => {
                return (
                  <View key={log.$id} style={styles.logItem}>
                    <View style={styles.logTopRow}>
                      <View style={styles.logActorBadge}>
                        <Text style={styles.logActorName}>{log.actor_id}</Text>
                      </View>
                      <Text style={styles.logDate}>
                        {new Date(log.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>

                    <Text style={styles.logAction}>
                      {log.action === 'VERIFIKASI_DOSEN_PENILAI'
                        ? 'Verifikasi & Pemilihan Dosen Pembimbing'
                        : log.action === 'DISAHKAN_KAPRODI'
                        ? 'Pengesahan Resmi oleh Kaprodi'
                        : log.action === 'MINTA_REVISI'
                        ? 'Permintaan Revisi Judul'
                        : log.action}
                    </Text>

                    {log.notes ? (
                      <View style={styles.logNotesBox}>
                        <Text style={styles.logNotesText}>
                          &ldquo;{log.notes}&rdquo;
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },

  // 1. Tracker Card
  trackerCard: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 16,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sectionSubheading: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  verticalStepper: {
    paddingVertical: 4,
    marginBottom: 16,
  },
  vStepItem: {
    flexDirection: 'row',
    position: 'relative',
  },
  vStepItemLast: {
    marginBottom: 0,
  },
  vStepLeft: {
    alignItems: 'center',
    width: 38,
    marginRight: 12,
  },
  vStepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  vStepCircleCompleted: {
    backgroundColor: Colors.primary,
  },
  vStepCircleActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  vStepCircleWarning: {
    backgroundColor: '#F59E0B',
  },
  vStepCircleDanger: {
    backgroundColor: '#EF4444',
  },
  vStepCircleInactive: {
    backgroundColor: '#E2E8F0',
  },
  vStepLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
    minHeight: 46,
  },
  vStepLineActive: {
    backgroundColor: Colors.primary,
  },
  vStepRight: {
    flex: 1,
    paddingBottom: 22,
  },
  vStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  vStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  vStepDesc: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  vStepDate: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
    fontWeight: '500',
  },
  vStepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  vBadgeSuccess: {
    backgroundColor: '#ECFDF5',
  },
  vBadgeTextSuccess: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  vBadgeActive: {
    backgroundColor: '#EFF6FF',
  },
  vBadgeTextActive: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  vBadgeWarning: {
    backgroundColor: '#FFFBEB',
  },
  vBadgeTextWarning: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  vBadgeDanger: {
    backgroundColor: '#FEF2F2',
  },
  vBadgeTextDanger: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  vBadgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  vBadgeTextInactive: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  statusDescriptionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusDescriptionText: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
  },

  // 2. Lembar Pengesahan Resmi Akademik (Sertifikat SK Formal)
  certFrameOuter: {
    padding: 3,
    borderRadius: 16,
    backgroundColor: '#1E3A5F',
    borderWidth: 1.5,
    borderColor: '#0A4C8F',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  certFrameInner: {
    backgroundColor: '#FAFAF9',
    borderRadius: 13,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  certKopHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  certEmblemBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#0A4C8F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  certKopInstansi: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  certKopUniv: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0A4C8F',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  certKopProdi: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
    marginTop: 1,
  },
  certKopDoubleLine: {
    width: '100%',
    marginTop: 10,
  },
  certKopLineThick: {
    height: 2.5,
    backgroundColor: '#0F172A',
  },
  certKopLineThin: {
    height: 1,
    backgroundColor: '#0F172A',
    marginTop: 2,
  },
  certTitleBlock: {
    alignItems: 'center',
    marginVertical: 12,
  },
  certDocType: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  certDocSubject: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A5F',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  certDocNumber: {
    fontSize: 10.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#475569',
    marginTop: 4,
  },
  certPreamble: {
    fontSize: 11.5,
    color: '#334155',
    lineHeight: 17,
    textAlign: 'justify',
    marginBottom: 12,
  },
  certDataGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  certDataRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  certDataLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  certDataValueTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 18,
  },
  certDataValueBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A4C8F',
  },
  certDataSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  certDataValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  certDataNotes: {
    fontSize: 11.5,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  certSignSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: 10,
  },
  certSignRightCol: {
    alignItems: 'center',
    minWidth: 200,
  },
  certSignDate: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '500',
    marginBottom: 2,
  },
  certSignRole: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  certDigitalSealContainer: {
    marginVertical: 6,
  },
  certStampCircle: {
    borderWidth: 2,
    borderColor: '#059669',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
  },
  certStampText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  certStampSub: {
    fontSize: 8,
    fontWeight: '700',
    color: '#059669',
  },
  certSignName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    textDecorationLine: 'underline',
    marginTop: 8,
  },
  certSignNip: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  certSecurityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
    marginTop: 6,
  },
  certSecurityText: {
    fontSize: 9.5,
    color: '#64748B',
    flex: 1,
    lineHeight: 13,
  },

  // 3. Dosen Pembimbing
  advisorSection: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisorCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  advisorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  advisorMainInfo: {
    flex: 1,
  },
  advisorName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  advisorNip: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  advisorProdiPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  advisorProdiText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  advisorDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  advisorMetaCol: {
    gap: 10,
  },
  advisorFieldBlock: {
    paddingVertical: 2,
  },
  advisorFieldLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  advisorFieldValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 18,
  },
  advisorFieldValueMono: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.primary,
    fontWeight: '700',
  },
  advisorQuotaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  advisorPendingSection: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    marginBottom: 16,
  },
  advisorPendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  advisorPendingTexts: {
    flex: 1,
  },
  advisorPendingTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#92400E',
  },
  advisorPendingSubtitle: {
    fontSize: 11.5,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },

  // 4. Judul Terpilih
  selectedTitleSection: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
  },
  selectedTitleHeader: {
    marginBottom: 10,
  },
  selectedTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  selectedTitleBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  selectedTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  selectedBgBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  boxLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  boxText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
  },
  journalBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  journalHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  journalTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  journalAuthorText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  btnPdf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  btnPdfText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 5. Options List
  listSectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  optionCard: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
  },
  optionNumberBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 8,
  },
  optionNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  optionTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  optionBgText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  journalSubBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  journalSubText: {
    fontSize: 11.5,
    color: Colors.textTertiary,
  },

  // 6. Other Options
  otherOptionsSection: {
    marginTop: 6,
    marginBottom: 12,
  },
  otherOptionsHeading: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  otherOptionCard: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  otherOptionHeader: {
    marginBottom: 4,
  },
  otherOptionNumber: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  otherOptionTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },

  // 7. Logs
  logsSection: {
    padding: 18,
    borderRadius: 22,
    marginTop: 6,
  },
  logsList: {
    gap: 12,
  },
  logItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logActorBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  logActorName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  logDate: {
    fontSize: 10.5,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logAction: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  logNotesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logNotesText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
