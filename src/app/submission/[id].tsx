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
  FileCheck,
  GraduationCap,
  MessageSquare,
  Share2,
  TableProperties,
  X,
  XCircle,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
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
  const [showSkModal, setShowSkModal] = useState(false);

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
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedApprovalDate = submission.kaprodiApprovalDate
    ? new Date(submission.kaprodiApprovalDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
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

  const handleOpenPdf = (fileId?: string | null) => {
    if (!fileId) return;
    const url = submissionService.getFileViewUrl(fileId);
    if (url) {
      Linking.openURL(url).catch((err) => console.warn('Cannot open URL', err));
    }
  };

  const handleShareSk = async () => {
    if (!submission) return;
    const content = `SURAT KEPUTUSAN PENGESAHAN JUDUL & DOSEN PEMBIMBING SKRIPSI
Nomor Surat: ${submission.nomor_surat || '-'}
No. Dokumen: SPSM-${submission.$id.toUpperCase()}
Urutan Pengesahan: ke-${submission.urutan_surat || '01'}

Judul Skripsi Disahkan:
"${selectedOption?.title || '-'}"

Dosen Pembimbing 1 (Utama):
${submission.advisor?.name || '-'} (NIP: ${submission.advisor?.nip || '-'})

Dosen Pembimbing 2 (Pendamping):
${submission.advisor2?.name || '-'} (NIP: ${submission.advisor2?.nip || '-'})

Tanggal Pengesahan: ${formattedApprovalDate || '-'}
Disahkan oleh Kaprodi: ${submission.kaprodiName || 'Ketua Program Studi'}
Catatan Pengesahan: ${submission.kaprodiNotes || 'Judul dan Dosen Pembimbing resmi disahkan oleh Kaprodi.'}

Sistem Pengajuan Judul Skripsi Mahasiswa (SPSM)`;

    try {
      await Share.share({
        title: `SK Pengesahan Skripsi - ${submission.nomor_surat || submission.$id}`,
        message: content,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const formatLogNotes = (notes: string | null, action: string) => {
    if (!notes) return '';
    if (action === 'PENGAJUAN_MAHASISWA') {
      try {
        const parsed = JSON.parse(notes);
        const name1 =
          submission?.preferredAdvisor1?.name ||
          parsed.pref1_name ||
          (parsed.pref1 ? `Dosen ID: ${parsed.pref1}` : 'Tidak ditentukan');
        const name2 =
          submission?.preferredAdvisor2?.name ||
          parsed.pref2_name ||
          (parsed.pref2 ? `Dosen ID: ${parsed.pref2}` : 'Tidak ditentukan');
        return `Usulan Calon Pembimbing:\n• Prioritas 1: ${name1}\n• Prioritas 2: ${name2}`;
      } catch {
        return notes;
      }
    }
    if (notes.startsWith('{')) {
      try {
        const parsed = JSON.parse(notes);
        if (parsed.nomor_surat) {
          return `Nomor SK: ${parsed.nomor_surat}\n${parsed.text || 'Disahkan oleh Kaprodi.'}`;
        }
        return parsed.text || parsed.notes || notes;
      } catch {
        return notes;
      }
    }
    return notes;
  };

  const statusLabel =
    submission.status === 'approved'
      ? 'Disahkan Kaprodi'
      : submission.status === 'waiting_kaprodi'
        ? 'Menunggu Kaprodi'
        : submission.status === 'revision'
          ? 'Perlu Revisi'
          : submission.status === 'rejected'
            ? 'Ditolak'
            : 'Tahap Penilaian Reviewer';

  return (
    <View style={styles.flex}>
      <AppHeader title="Detail Pengajuan Skripsi" showBack backHref="/dashboard" />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
        {/* HEADER CARD — Ringkasan Pengajuan */}
        <Section style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeftCol}>
              <View style={styles.headerIconBox}>
                <GraduationCap size={20} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.headerTexts}>
                <Text style={styles.headerTitle} numberOfLines={1}>Pengajuan Skripsi</Text>
                <Text style={styles.headerId} numberOfLines={1} ellipsizeMode="middle">
                  NO. DOKUMEN: SPSM-{submission.$id.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.headerBadgeWrap}>
              <StatusBadge status={submission.status} size="sm" />
            </View>
          </View>

          <View style={styles.headerDivider} />

          <View style={styles.headerMetaRow}>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Tanggal Pengajuan</Text>
              <Text style={styles.headerMetaValue}>{formattedSubmittedDate}</Text>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Status</Text>
              <Text style={styles.headerMetaValueHL}>{statusLabel}</Text>
            </View>
          </View>
        </Section>

        {/* SK PENGESAHAN RESMI CARD (Spesifikasi v2.0) */}
        {submission.status === 'approved' && (
          <Section style={styles.skOfficialCard}>
            <View style={styles.skOfficialTop}>
              <View style={styles.skOfficialBadge}>
                <Award size={15} color="#059669" strokeWidth={2.4} />
                <Text style={styles.skOfficialBadgeText}>SK RESMI DISAHKAN</Text>
              </View>
              {submission.urutan_surat && (
                <View style={styles.skUrutanBadge}>
                  <Text style={styles.skUrutanBadgeText}>Urutan #{submission.urutan_surat}</Text>
                </View>
              )}
            </View>

            <View style={styles.skNumberBox}>
              <Text style={styles.skNumberLabel}>NOMOR SURAT KEPUTUSAN:</Text>
              <Text style={styles.skNumberValue}>{submission.nomor_surat || '-'}</Text>
            </View>

            <View style={styles.skButtonRow}>
              <TouchableOpacity
                style={styles.skDownloadBtn}
                onPress={() => setShowSkModal(true)}
                activeOpacity={0.8}
              >
                <FileCheck size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.skDownloadBtnText}>Unduh / Cetak Dokumen SK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skShareBtn}
                onPress={handleShareSk}
                activeOpacity={0.8}
              >
                <Share2 size={16} color={Colors.primary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </Section>
        )}

        {/* 1. STATUS PROGRESS TRACKER */}
        <Section style={styles.trackerCard}>
          <Text style={styles.sectionHeading}>Alur Proses Pengajuan</Text>

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
                  <Text style={styles.vStepTitle}>3. Pengesahan Kaprodi</Text>
                  {submission.status === 'approved' && (
                    <View style={[styles.vStepBadge, styles.vBadgeSuccess]}>
                      <Text style={styles.vBadgeTextSuccess}>Disahkan</Text>
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
                    `Pengesahan judul resmi oleh ${submission.kaprodiName || 'Ketua Program Studi'}.`}
                  {submission.status === 'waiting_kaprodi' &&
                    'Menunggu validasi akhir dan pengesahan oleh Kaprodi.'}
                  {currentStage === 1 &&
                    'Pengesahan akan diproses setelah lolos verifikasi Dosen Penilai.'}
                  {(submission.status === 'revision' || submission.status === 'rejected') &&
                    'Tahap pengesahan ditiadakan karena pengajuan tidak berlanjut.'}
                </Text>
                {formattedApprovalDate ? (
                  <Text style={styles.vStepDate}>Disahkan: {formattedApprovalDate}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Status Explanation */}
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

        {/* 2. PENGESAHAN KAPRODI — Simple Approval Card (only when approved) */}
        {submission.status === 'approved' && (
          <Section style={styles.approvalCard}>
            <View style={styles.approvalHeaderRow}>
              <View style={styles.approvalIconBox}>
                <CheckCircle2 size={20} color="#059669" strokeWidth={2.4} />
              </View>
              <View style={styles.approvalHeaderTexts}>
                <Text style={styles.approvalTitle}>Pengajuan Disahkan</Text>
                <Text style={styles.approvalSubtitle}>
                  Judul skripsi dan Dosen Pembimbing telah resmi ditetapkan
                </Text>
              </View>
            </View>

            <View style={styles.approvalDivider} />

            {/* Approved Details */}
            <View style={styles.approvalDetails}>
              {selectedOption ? (
                <View style={styles.approvalDetailRow}>
                  <Text style={styles.approvalDetailLabel}>Judul Disahkan</Text>
                  <Text style={styles.approvalDetailValueBold}>
                    &ldquo;{selectedOption.title}&rdquo;
                  </Text>
                </View>
              ) : null}

              {submission.advisor ? (
                <View style={styles.approvalDetailRow}>
                  <Text style={styles.approvalDetailLabel}>Dosen Pembimbing 1 (Utama)</Text>
                  <Text style={styles.approvalDetailValueBold}>
                    {submission.advisor.name}
                  </Text>
                  <Text style={styles.approvalDetailSub}>
                    NIP: {submission.advisor.nip} · {submission.advisor.expertise || 'Umum'}
                  </Text>
                </View>
              ) : null}

              {submission.advisor2 ? (
                <View style={styles.approvalDetailRow}>
                  <Text style={styles.approvalDetailLabel}>Dosen Pembimbing 2 (Pendamping)</Text>
                  <Text style={styles.approvalDetailValueBold}>
                    {submission.advisor2.name}
                  </Text>
                  <Text style={styles.approvalDetailSub}>
                    NIP: {submission.advisor2.nip} · {submission.advisor2.expertise || 'Umum'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.approvalDetailRow}>
                <Text style={styles.approvalDetailLabel}>Tanggal Pengesahan</Text>
                <Text style={styles.approvalDetailValue}>
                  {formattedApprovalDate || formattedSubmittedDate}
                </Text>
              </View>

              <View style={styles.approvalDetailRow}>
                <Text style={styles.approvalDetailLabel}>Disahkan oleh</Text>
                <Text style={styles.approvalDetailValue}>
                  {submission.kaprodiName || 'Ketua Program Studi'}
                </Text>
              </View>

              {submission.kaprodiNotes ? (
                <View style={[styles.approvalDetailRow, styles.approvalLastRow]}>
                  <Text style={styles.approvalDetailLabel}>Catatan</Text>
                  <Text style={styles.approvalDetailNotes}>{submission.kaprodiNotes}</Text>
                </View>
              ) : null}
            </View>
          </Section>
        )}

        {/* 3. DETAIL DOSEN PEMBIMBING (hidden if revision/rejected) */}
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
                      ? 'Resmi ditetapkan oleh Kaprodi'
                      : 'Ditetapkan oleh Reviewer (Menunggu Pengesahan Final)'}
                  </Text>
                </View>
              </View>

              {/* Dosen Pembimbing 1 (Utama) */}
              <View style={styles.advisorCard}>
                <View style={styles.advisorTopRow}>
                  <Avatar
                    name={submission.advisor.name}
                    size={54}
                    backgroundColor={Colors.primary}
                  />
                  <View style={styles.advisorMainInfo}>
                    <View style={styles.advisorRolePill}>
                      <Text style={styles.advisorRolePillText}>Pembimbing 1 (Utama)</Text>
                    </View>
                    <Text style={styles.advisorName}>{submission.advisor.name}</Text>
                    <Text style={styles.advisorNip}>NIP / NIDN: {submission.advisor.nip}</Text>
                  </View>
                </View>

                <View style={styles.advisorDivider} />

                <View style={styles.advisorMetaCol}>
                  <View style={styles.advisorFieldBlock}>
                    <Text style={styles.advisorFieldLabel}>Bidang Keahlian:</Text>
                    <Text style={styles.advisorFieldValue}>
                      {submission.advisor.expertise || 'Umum'}
                    </Text>
                  </View>
                  <View style={styles.advisorFieldBlock}>
                    <Text style={styles.advisorFieldLabel}>Email Institusi:</Text>
                    <Text style={styles.advisorFieldValueMono}>
                      {submission.advisor.email}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Dosen Pembimbing 2 (Pendamping) jika ada */}
              {submission.advisor2 && (
                <View style={[styles.advisorCard, { marginTop: 12 }]}>
                  <View style={styles.advisorTopRow}>
                    <Avatar
                      name={submission.advisor2.name}
                      size={54}
                      backgroundColor="#0D9488"
                    />
                    <View style={styles.advisorMainInfo}>
                      <View style={[styles.advisorRolePill, { backgroundColor: '#CCFBF1' }]}>
                        <Text style={[styles.advisorRolePillText, { color: '#0F766E' }]}>
                          Pembimbing 2 (Pendamping)
                        </Text>
                      </View>
                      <Text style={styles.advisorName}>{submission.advisor2.name}</Text>
                      <Text style={styles.advisorNip}>NIP / NIDN: {submission.advisor2.nip}</Text>
                    </View>
                  </View>

                  <View style={styles.advisorDivider} />

                  <View style={styles.advisorMetaCol}>
                    <View style={styles.advisorFieldBlock}>
                      <Text style={styles.advisorFieldLabel}>Bidang Keahlian:</Text>
                      <Text style={styles.advisorFieldValue}>
                        {submission.advisor2.expertise || 'Umum'}
                      </Text>
                    </View>
                    <View style={styles.advisorFieldBlock}>
                      <Text style={styles.advisorFieldLabel}>Email Institusi:</Text>
                      <Text style={styles.advisorFieldValueMono}>
                        {submission.advisor2.email}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
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
                  {(submission.preferredAdvisor1 || submission.preferredAdvisor2) && (
                    <View style={styles.preferredAdvisorsBox}>
                      <Text style={styles.preferredAdvisorsTitle}>Pilihan Dosen Anda:</Text>
                      {submission.preferredAdvisor1 && (
                        <Text style={styles.preferredAdvisorItem}>
                          • Prioritas 1: {submission.preferredAdvisor1.name}
                        </Text>
                      )}
                      {submission.preferredAdvisor2 && (
                        <Text style={styles.preferredAdvisorItem}>
                          • Prioritas 2: {submission.preferredAdvisor2.name}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </Section>
          )
        )}

        {/* 4. DAFTAR USULAN OPSI JUDUL SKRIPSI (1 KARTU TERSUSUN 3 JUDUL DENGAN PEMISAH LINE) */}
        {submission.options && submission.options.length > 0 ? (
          <Section style={styles.allOptionsUnifiedCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <BookOpen size={18} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionHeading}>Daftar Usulan Opsi Judul Skripsi</Text>
                <Text style={styles.sectionSubheading}>
                  Rincian 3 usulan judul beserta latar belakang dan rumusan masalah
                </Text>
              </View>
            </View>

            <View style={styles.unifiedOptionsContainer}>
              {submission.options.map((opt, index) => {
                const isSelected = opt.is_selected_by_lecturer;
                const isLast = index === submission.options!.length - 1;

                return (
                  <View key={opt.$id} style={styles.optionBlock}>
                    {/* Header Row: Opsi Badge + Judul Terpilih Badge */}
                    <View style={styles.optionHeaderRow}>
                      <View
                        style={[
                          styles.unifiedOptionBadge,
                          isSelected && styles.unifiedOptionBadgeSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.unifiedOptionBadgeText,
                            isSelected && styles.unifiedOptionBadgeTextSelected,
                          ]}
                        >
                          Opsi #{opt.option_number}
                        </Text>
                      </View>

                      {isSelected && (
                        <View style={styles.selectedPillBadge}>
                          <CheckCircle2 size={13} color="#FFFFFF" strokeWidth={2.5} />
                          <Text style={styles.selectedPillText}>Judul Terpilih / Disahkan</Text>
                        </View>
                      )}
                    </View>

                    {/* Judul Skripsi */}
                    <Text
                      style={[
                        styles.unifiedOptionTitle,
                        isSelected && styles.unifiedOptionTitleSelected,
                      ]}
                    >
                      {opt.title}
                    </Text>

                    {/* Latar Belakang & Rumusan Masalah */}
                    <View
                      style={[
                        styles.unifiedBgBox,
                        isSelected && styles.unifiedBgBoxSelected,
                      ]}
                    >
                      <Text style={styles.unifiedBgLabel}>
                        Latar Belakang & Rumusan Masalah:
                      </Text>
                      <Text style={styles.unifiedBgText}>{opt.background}</Text>
                    </View>

                    {/* Jurnal Acuan Pendukung (jika ada) */}
                    {opt.journal_title ? (
                      <View style={styles.unifiedJournalBox}>
                        <View style={styles.unifiedJournalHeader}>
                          <BookOpen size={13} color={Colors.primary} strokeWidth={2} />
                          <Text style={styles.unifiedJournalTitle}>
                            Jurnal Acuan: {opt.journal_title}
                          </Text>
                        </View>
                        {opt.journal_author ? (
                          <Text style={styles.unifiedJournalAuthor}>
                            Penulis / Sumber: {opt.journal_author}
                          </Text>
                        ) : null}

                        {opt.journal_file_id ? (
                          <TouchableOpacity
                            style={styles.btnPdfSmall}
                            onPress={() => handleOpenPdf(opt.journal_file_id)}
                            activeOpacity={0.8}
                          >
                            <ExternalLink size={12} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.btnPdfSmallText}>Lihat Berkas PDF Jurnal</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}

                    {/* Tabel Relevansi Penelitian (Spesifikasi v2.0) */}
                    {(opt.relevance_variable || opt.relevance_methodology || opt.relevance_note) && (
                      <View style={styles.relevanceCard}>
                        <View style={styles.relevanceHeader}>
                          <TableProperties size={13} color={Colors.primary} strokeWidth={2.2} />
                          <Text style={styles.relevanceHeaderTitle}>Tabel Relevansi Penelitian</Text>
                        </View>
                        {opt.relevance_variable ? (
                          <View style={styles.relevanceRow}>
                            <Text style={styles.relevanceRowLabel}>Variabel / Fokus:</Text>
                            <Text style={styles.relevanceRowValue}>{opt.relevance_variable}</Text>
                          </View>
                        ) : null}
                        {opt.relevance_methodology ? (
                          <View style={styles.relevanceRow}>
                            <Text style={styles.relevanceRowLabel}>Metodologi Jurnal:</Text>
                            <Text style={styles.relevanceRowValue}>{opt.relevance_methodology}</Text>
                          </View>
                        ) : null}
                        {opt.relevance_note ? (
                          <View style={styles.relevanceRow}>
                            <Text style={styles.relevanceRowLabel}>Kesesuaian Topik:</Text>
                            <Text style={styles.relevanceRowValue}>{opt.relevance_note}</Text>
                          </View>
                        ) : null}
                      </View>
                    )}

                    {/* Catatan Khusus Reviewer untuk Judul Ini */}
                    {opt.revision_note && (
                      <View style={styles.optionRevisionNoteBox}>
                        <AlertTriangle size={14} color="#D97706" strokeWidth={2.2} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optionRevisionNoteTitle}>Catatan Penilaian:</Text>
                          <Text style={styles.optionRevisionNoteText}>{opt.revision_note}</Text>
                        </View>
                      </View>
                    )}

                    {/* Line Separator between options */}
                    {!isLast && <View style={styles.optionDividerLine} />}
                  </View>
                );
              })}
            </View>
          </Section>
        ) : null}

        {/* 5. RIWAYAT LOG CATATAN & EVALUASI */}
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
                        : log.action === 'PENGAJUAN_MAHASISWA'
                        ? 'Usulan Pengajuan oleh Mahasiswa'
                        : log.action}
                    </Text>

                    {log.notes ? (
                      <View style={styles.logNotesBox}>
                        <Text style={styles.logNotesText}>
                          {formatLogNotes(log.notes, log.action)}
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

      {/* MODAL SK PENGESAHAN MAHASISWA */}
      <Modal
        visible={showSkModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSkModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeaderTitle}>Lembar Keputusan Pengesahan</Text>
                <Text style={styles.modalHeaderSubtitle}>Dokumen Resmi SK Pembimbing Skripsi</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSkModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal Body / Official SK Sheet */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Kop Dokumen */}
              <View style={styles.skDocHeader}>
                <View style={styles.skDocLogo}>
                  <GraduationCap size={28} color={Colors.primary} strokeWidth={2.4} />
                </View>
                <Text style={styles.skDocInstitution}>SISTEM PENGAJUAN SKRIPSI MAHASISWA (SPSM)</Text>
                <Text style={styles.skDocTitle}>SURAT KEPUTUSAN PENGESAHAN</Text>
                <Text style={styles.skDocSubtitle}>
                  PENETAPAN JUDUL SKRIPSI DAN PENGANGKATAN DOSEN PEMBIMBING
                </Text>
                <View style={styles.skDocDoubleLine} />
              </View>

              {/* Nomor Surat & Tanggal */}
              <View style={styles.skDocMetaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.skDocMetaLabel}>NOMOR SURAT KEPUTUSAN</Text>
                  <Text style={styles.skDocMetaValHighlight}>{submission.nomor_surat || '-'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.skDocMetaLabel}>URUTAN PENETAPAN</Text>
                  <Text style={styles.skDocMetaVal}>ke-{submission.urutan_surat || '01'}</Text>
                </View>
              </View>

              {/* Data Pengajuan */}
              <View style={styles.skDocSection}>
                <Text style={styles.skDocSectionTitle}>I. IDENTITAS PENGAJUAN</Text>
                <View style={styles.skDocRow}>
                  <Text style={styles.skDocColLabel}>No. Dokumen:</Text>
                  <Text style={styles.skDocColValue}>SPSM-{submission.$id.toUpperCase()}</Text>
                </View>
                <View style={styles.skDocRow}>
                  <Text style={styles.skDocColLabel}>Tanggal Pengajuan:</Text>
                  <Text style={styles.skDocColValue}>{formattedSubmittedDate}</Text>
                </View>
                <View style={styles.skDocRow}>
                  <Text style={styles.skDocColLabel}>Tanggal Pengesahan:</Text>
                  <Text style={styles.skDocColValue}>{formattedApprovalDate || '-'}</Text>
                </View>
              </View>

              {/* Judul Skripsi Terpilih */}
              <View style={styles.skDocSection}>
                <Text style={styles.skDocSectionTitle}>II. JUDUL SKRIPSI YANG DISAHKAN</Text>
                <View style={styles.skDocTitleBox}>
                  <Text style={styles.skDocChosenTitle}>
                    &ldquo;{selectedOption?.title || 'Judul skripsi terpilih'}&rdquo;
                  </Text>
                </View>
              </View>

              {/* Tim Dosen Pembimbing */}
              <View style={styles.skDocSection}>
                <Text style={styles.skDocSectionTitle}>III. SUSUNAN DOSEN PEMBIMBING</Text>
                <View style={styles.skDocAdvisorBox}>
                  <Text style={styles.skDocAdvisorRole}>1. Dosen Pembimbing Utama (Pembimbing 1):</Text>
                  <Text style={styles.skDocAdvisorName}>{submission.advisor?.name || '-'}</Text>
                  <Text style={styles.skDocAdvisorNip}>NIP/NIDN: {submission.advisor?.nip || '-'}</Text>
                </View>

                {submission.advisor2 && (
                  <View style={[styles.skDocAdvisorBox, { marginTop: 8 }]}>
                    <Text style={styles.skDocAdvisorRole}>2. Dosen Pembimbing Pendamping (Pembimbing 2):</Text>
                    <Text style={styles.skDocAdvisorName}>{submission.advisor2.name}</Text>
                    <Text style={styles.skDocAdvisorNip}>NIP/NIDN: {submission.advisor2.nip || '-'}</Text>
                  </View>
                )}
              </View>

              {/* Pengesahan Digital Kaprodi */}
              <View style={styles.skDocSignSection}>
                <Text style={styles.skDocSignCity}>Disahkan secara digital oleh:</Text>
                <Text style={styles.skDocSignRole}>Ketua Program Studi</Text>
                <View style={styles.skDocStampBox}>
                  <CheckCircle2 size={16} color="#059669" strokeWidth={2.4} />
                  <Text style={styles.skDocStampText}>DIGITALLY VERIFIED & APPROVED</Text>
                </View>
                <Text style={styles.skDocSignName}>{submission.kaprodiName || 'Ketua Program Studi'}</Text>
                {formattedApprovalDate && (
                  <Text style={styles.skDocSignDate}>{formattedApprovalDate}</Text>
                )}
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalShareBtn}
                onPress={handleShareSk}
                activeOpacity={0.8}
              >
                <Share2 size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.modalShareBtnText}>Bagikan / Simpan Ringkasan SK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCloseActionBtn}
                onPress={() => setShowSkModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseActionText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Header Card
  headerCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeftCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTexts: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: Colors.text,
  },
  headerId: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  headerBadgeWrap: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  headerMetaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  headerMetaItem: {
    flex: 1,
  },
  headerMetaLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  headerMetaValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  headerMetaValueHL: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },

  // 1. Tracker Card
  trackerCard: {
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: 16,
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

  // 2. Approval Card (simple card replacing the formal certificate)
  approvalCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  approvalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  approvalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalHeaderTexts: {
    flex: 1,
  },
  approvalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  approvalSubtitle: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 2,
  },
  approvalDivider: {
    height: 1,
    backgroundColor: '#BBF7D0',
    marginVertical: 14,
  },
  approvalDetails: {
    gap: 12,
  },
  approvalDetailRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#DCFCE7',
    paddingBottom: 10,
  },
  approvalLastRow: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  approvalDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ADE80',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  approvalDetailValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#14532D',
    lineHeight: 20,
  },
  approvalDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  approvalDetailSub: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 2,
  },
  approvalDetailNotes: {
    fontSize: 12.5,
    color: '#166534',
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // 3. Dosen Pembimbing
  advisorSection: {
    padding: 18,
    borderRadius: 16,
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
  advisorRolePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  advisorRolePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  preferredAdvisorsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  preferredAdvisorsTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  preferredAdvisorItem: {
    fontSize: 11.5,
    color: '#78350F',
    lineHeight: 16,
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
    borderRadius: 16,
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

  // 4. All Options Unified Card (1 Card with 3 Options separated by dividers)
  allOptionsUnifiedCard: {
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  unifiedOptionsContainer: {
    marginTop: 14,
  },
  optionBlock: {
    paddingVertical: 4,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  unifiedOptionBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  unifiedOptionBadgeSelected: {
    backgroundColor: '#059669',
  },
  unifiedOptionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  unifiedOptionBadgeTextSelected: {
    color: '#FFFFFF',
  },
  selectedPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  selectedPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unifiedOptionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 21,
    marginBottom: 8,
  },
  unifiedOptionTitleSelected: {
    color: '#0A4C8F',
    fontWeight: '800',
  },
  unifiedBgBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  unifiedBgBoxSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  unifiedBgLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  unifiedBgText: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
  unifiedJournalBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  unifiedJournalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unifiedJournalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    flex: 1,
  },
  unifiedJournalAuthor: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 6,
  },
  btnPdfSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  btnPdfSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Tabel Relevansi Card
  relevanceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  relevanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  relevanceHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  relevanceRow: {
    marginTop: 4,
  },
  relevanceRowLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  relevanceRowValue: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
    marginTop: 1,
  },
  // Option Revision Note Box
  optionRevisionNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  optionRevisionNoteTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  optionRevisionNoteText: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 16,
  },
  optionDividerLine: {
    height: 1.5,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },

  // 5. Logs
  logsSection: {
    padding: 18,
    borderRadius: 16,
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

  // SK Official Card
  skOfficialCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  skOfficialTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  skOfficialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
  },
  skOfficialBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  skUrutanBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  skUrutanBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  skNumberBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skNumberLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  skNumberValue: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#065F46',
  },
  skButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
  },
  skDownloadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skShareBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },

  // Modal SK Pengesahan
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
  },
  skDocHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  skDocLogo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  skDocInstitution: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  skDocTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  skDocSubtitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 280,
  },
  skDocDoubleLine: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.text,
    marginTop: 12,
    borderRadius: 2,
  },
  skDocMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skDocMetaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  skDocMetaValHighlight: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#065F46',
    marginTop: 2,
  },
  skDocMetaVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  skDocSection: {
    marginBottom: 14,
  },
  skDocSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  skDocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  skDocColLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  skDocColValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  skDocTitleBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  skDocChosenTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    lineHeight: 18,
  },
  skDocAdvisorBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skDocAdvisorRole: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  skDocAdvisorName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  skDocAdvisorNip: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  skDocSignSection: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  skDocSignCity: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  skDocSignRole: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  skDocStampBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginVertical: 10,
  },
  skDocStampText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  skDocSignName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    textDecorationLine: 'underline',
  },
  skDocSignDate: {
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalShareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalShareBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCloseActionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
