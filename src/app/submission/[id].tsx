import { AppHeader, Avatar, Button, LoadingScreen, Section, StatusBadge } from '@/components';
import { isActiveSubmissionStatus, type ThesisSubmission } from '@/models/types';
import { apiClient } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { onRealtimeEvent } from '@/services/realtimeService';
import { settingsService } from '@/services/settingsService';
import { submissionService } from '@/services/submissionService';
import { Colors } from '@/theme/theme';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  GraduationCap,
  MessageSquare,
  Share2,
  TableProperties,
  Upload,
  X,
  XCircle
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({});
  const [uploadingSkripsi, setUploadingSkripsi] = useState(false);
  const [hasActiveSubmission, setHasActiveSubmission] = useState(false);
  const [requiredTitleCount, setRequiredTitleCount] = useState<number | null>(null);

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
        settingsService
          .getSettings()
          .then((s) => active && setRequiredTitleCount(s.required_title_count))
          .catch(() => {});

        // Cek apakah mahasiswa punya pengajuan aktif lain (pending/waiting/approved)
        try {
          const acct = await authService.getCurrentAccount();
          const allSubs = await submissionService.getStudentSubmissions(acct.$id);
          const otherActive = allSubs.some(
            (s) => s.$id !== id && isActiveSubmissionStatus(s.status)
          );
          if (active) setHasActiveSubmission(otherActive);
        } catch {
          // abaikan — tombol resubmit tetap bisa dipakai
        }
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

  // Realtime: refetch detail secara silent saat ada perubahan pada pengajuan ini
  // (status, options, logs persetujuan, data surat/SK, atau settings global).
  const rtTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSubmission = useCallback(async () => {
    if (!id) return;
    try {
      const sub = await submissionService.getSubmissionWithDetails(id);
      setSubmission(sub);
      settingsService
        .getSettings()
        .then((s) => setRequiredTitleCount(s.required_title_count))
        .catch(() => {});
    } catch {
      // biarkan data lama tetap tampil saat fetch gagal
    }
  }, [id]);

  useEffect(() => {
    const unsubscribe = onRealtimeEvent((event) => {
      if (event.type === 'ready' || event.type === 'pong') return;
      const relevant =
        event.type === 'settings' ||
        event.submissionId === id ||
        event.id === id ||
        (event.collection === 'users' && event.ownerId != null);
      if (!relevant) return;
      if (rtTimer.current) clearTimeout(rtTimer.current);
      rtTimer.current = setTimeout(() => {
        rtTimer.current = null;
        void refreshSubmission();
      }, 800);
    });
    return () => {
      unsubscribe();
      if (rtTimer.current) clearTimeout(rtTimer.current);
    };
  }, [id, refreshSubmission]);

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

  const verificationLog = submission.logs?.find(
    (log) => log.action === 'VERIFIKASI_DOSEN_PENILAI'
  );
  const formattedVerificationDate = verificationLog
    ? new Date(verificationLog.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const kaprodiLog = submission.logs?.find(
    (log) =>
      log.action === 'DISAHKAN_KAPRODI' ||
      log.action === 'PENGESAHAN_KAPRODI' ||
      log.action === 'APPROVAL_KAPRODI'
  );
  const formattedKaprodiDate = kaprodiLog
    ? new Date(kaprodiLog.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : formattedApprovalDate;

  const tuLog = submission.logs?.find(
    (log) => log.action === 'PROSES_TTD_DEKAN' || log.action === 'PENOMORAN_SURAT'
  );
  const formattedTuDate = tuLog
    ? new Date(tuLog.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const skIssuedLog = submission.logs?.find(
    (log) => log.action === 'UPLOAD_SCAN_SK' || log.action === 'SK_TERBIT'
  );
  const formattedSkIssuedDate = skIssuedLog
    ? new Date(skIssuedLog.created_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : submission.sk_generated_at
    ? new Date(submission.sk_generated_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  let currentStage = 1;
  if (submission.status === 'pending_lecturer') currentStage = 1;
  else if (submission.status === 'waiting_kaprodi') currentStage = 2;
  else if (submission.status === 'waiting_akademik') currentStage = 3;
  else if (submission.status === 'sk_process') currentStage = 4;
  else if (submission.status === 'sk_issued' || submission.status === 'approved') currentStage = 5;

  const isSkIssued =
    submission.status === 'sk_issued' || submission.status === 'approved';

  const isSkReady = Boolean(
    isSkIssued ||
      submission.surat?.scannedSkId ||
      submission.surat?.scanned_sk_id ||
      submission.surat?.nomor_surat ||
      submission.nomor_surat
  );

  const selectedOption =
    submission.selectedOption ||
    submission.options?.find((o) => o.is_selected_by_lecturer) ||
    null;

  const toggleOptionExpansion = (optionId: string) => {
    setExpandedOptions((prev) => ({
      ...prev,
      [optionId]: !prev[optionId],
    }));
  };

  const handleOpenPdf = async (fileId?: string | null) => {
    if (!fileId) return;
    const url = await submissionService.getFileViewUrl(fileId);
    if (url) {
      Linking.openURL(url).catch((err) => console.warn('Cannot open URL', err));
    }
  };

  const handleDownloadSk = async () => {
    if (!submission) return;
    const scannedSkId = submission.surat?.scannedSkId || submission.surat?.scanned_sk_id;
    if (scannedSkId) {
      const url = await submissionService.getFileViewUrlForBucket('sk', scannedSkId);
      if (url) {
        Linking.openURL(url).catch((err) => console.warn('Cannot open scanned SK URL', err));
        return;
      }
    }
    // Template SK dari backend: file documen dengan payload terisi.
    try {
      const skFile = await apiClient.surat.getSkFile(id);
      if (skFile?.url) {
        Linking.openURL(skFile.url).catch((err) => console.warn('Cannot open SK file URL', err));
        return;
      }
    } catch (err) {
      console.warn('Generated SK file unavailable:', err);
    }
    const templateSkId = submission.surat?.templateSkId || submission.surat?.template_sk_id;
    if (templateSkId) {
      const url = await submissionService.getFileViewUrlForBucket('sk', templateSkId);
      if (url) {
        Linking.openURL(url).catch((err) => console.warn('Cannot open template SK URL', err));
        return;
      }
    }
    // Fallback: tampilkan modal SK digital
    setShowSkModal(true);
  };

  const handleShareSk = async () => {
    if (!submission) return;
    const content = `SURAT KEPUTUSAN PENGESAHAN JUDUL & DOSEN PEMBIMBING SKRIPSI
Nomor Surat: ${submission.nomor_surat || '-'}
No. Dokumen: ${submission.surat?.no_dokumen || submission.surat?.noDokumen || `SPSM-${submission.$id.toUpperCase()}`}
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

Sarana Pengajuan Judul Skripsi Mahasiswa (SPSM) - Universitas Muhammadiyah Aceh`;

    try {
      await Share.share({
        title: `SK Pengesahan Skripsi - ${submission.nomor_surat || submission.$id}`,
        message: content,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  // ---- Upload Skripsi (untuk status approved) ----
  const skripsiLog = [...(submission.logs || [])]
    .reverse()
    .find((l) => l.action === 'UPLOAD_SKRSIPSI');

  let uploadedSkripsi: {
    file_id: string;
    file_name: string;
    size: number;
    date: string;
  } | null = null;
  if (skripsiLog?.notes) {
    try {
      const parsed = JSON.parse(skripsiLog.notes);
      if (parsed.file_id) {
        uploadedSkripsi = {
          file_id: parsed.file_id,
          file_name: parsed.file_name || 'skripsi.pdf',
          size: parsed.size || 0,
          date: skripsiLog.created_at,
        };
      }
    } catch {
      // ignore
    }
  }

  const reloadSubmission = async () => {
    if (!id) return;
    try {
      const sub = await submissionService.getSubmissionWithDetails(id);
      setSubmission(sub);
    } catch (e) {
      console.error('Failed to reload submission', e);
    }
  };

  const handleUploadSkripsi = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const isPdf =
        (asset.mimeType || '').toLowerCase() === 'application/pdf' ||
        (asset.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        Alert.alert('Format Tidak Didukung', 'Hanya file PDF yang dapat diupload.');
        return;
      }

      const current = await authService.getCurrentAccount();
      setUploadingSkripsi(true);

      const storedName = `owner_${current.$id}__${asset.name}`;
      const uploaded = await apiClient.files.upload('journals', asset, storedName);

      // Catat upload ke approval log agar terhubung dengan submission ini
      await apiClient.submissions.updateStatus(
        submission.$id,
        submission.status,
        'Mahasiswa (Pemohon)',
        'UPLOAD_SKRSIPSI',
        JSON.stringify({
          text: `File skripsi diupload: ${asset.name}`,
          file_id: uploaded.fileId,
          file_name: asset.name,
          size: asset.size || 0,
        })
      );

      // Tandai mahasiswa sudah upload skripsi
      await authService.markThesisUploaded(current.$id);

      await reloadSubmission();
      Alert.alert('Berhasil', 'File skripsi berhasil diupload.');
    } catch (error: any) {
      console.error('Upload skripsi error:', error);
      Alert.alert('Error', `Gagal upload file: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingSkripsi(false);
    }
  };

  const handleViewUploadedSkripsi = async () => {
    if (!uploadedSkripsi) return;
    const viewUrl = await apiClient.files.getViewUrl('journals', uploadedSkripsi.file_id);
    router.push({
      pathname: '/skripsiku/read',
      params: {
        id: uploadedSkripsi.file_id,
        name: uploadedSkripsi.file_name,
        uri: viewUrl,
        size: String(uploadedSkripsi.size),
        type: 'application/pdf',
      },
    } as any);
  };

  const formatSkripsiSize = (bytes: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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
    submission.status === 'sk_issued' || submission.status === 'approved'
      ? 'SK Resmi Terbit'
      : submission.status === 'sk_process'
      ? 'Proses TTD Dekan'
      : submission.status === 'waiting_akademik'
      ? 'Menunggu Administrasi TU'
      : submission.status === 'waiting_kaprodi'
      ? 'Pleno Kaprodi'
      : submission.status === 'revision'
      ? 'Perlu Revisi'
      : submission.status === 'rejected'
      ? 'Ditolak'
      : submission.status === 'drafting'
      ? 'Draf'
      : 'Menunggu Review';

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
                  NO. DOKUMEN:{' '}
                  {submission.surat?.no_dokumen ||
                    submission.surat?.noDokumen ||
                    `SPSM_${submission.$id.toUpperCase().slice(0, 12)}`}
                </Text>
                {submission.nomor_surat && (
                  <Text style={styles.headerSkId} numberOfLines={1} ellipsizeMode="middle">
                    NO. SK: {submission.nomor_surat}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.headerBadgeAbsolute}>
            <StatusBadge status={submission.status} size="sm" />
          </View>

          <View style={styles.headerDivider} />

          <View style={styles.headerMetaRow}>
            <View style={styles.headerMetaItem}>
              <View style={styles.dateContainer}>
                <View style={styles.dateItem}>
                  <Text style={styles.headerMetaLabel}>Tanggal Pengajuan</Text>
                  <Text style={styles.headerMetaValue}>{formattedSubmittedDate}</Text>
                </View>
                {formattedApprovalDate && (
                  <View style={styles.dateItem}>
                    <Text style={styles.headerMetaLabel}>Tanggal Disahkan</Text>
                    <Text style={styles.headerMetaValue}>{formattedApprovalDate}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Status</Text>
              <Text style={styles.headerMetaValueHL}>{statusLabel}</Text>
            </View>
          </View>

        </Section>

        {/* SK PENGESAHAN RESMI CARD */}
        {isSkReady && (
          <Section style={styles.skOfficialCard}>
            <View style={styles.skOfficialTop}>
              <View style={styles.skOfficialBadge}>
                <Award size={15} color={Colors.primary} strokeWidth={2.4} />
                <Text style={styles.skOfficialBadgeText}>
                  {submission.status === 'sk_issued' || submission.status === 'approved'
                    ? 'SK RESMI TELAH TERBIT'
                    : 'SURAT KEPUTUSAN DALAM PENERBITAN'}
                </Text>
              </View>
            </View>

            <View style={styles.skNumberBox}>
              <Text style={styles.skNumberLabel}>NOMOR SURAT KEPUTUSAN:</Text>
              <Text style={styles.skNumberValue}>{submission.nomor_surat || '-'}</Text>
            </View>

            {isSkIssued && (
              <View style={styles.skButtonRow}>
                <TouchableOpacity
                  style={styles.skDownloadBtn}
                  onPress={handleDownloadSk}
                  activeOpacity={0.8}
                >
                  <Download size={16} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.skDownloadBtnText}>
                    {submission.surat?.scannedSkId || submission.surat?.scanned_sk_id
                      ? 'Unduh File Scan SK Basah (PDF)'
                      : 'Unduh / Cetak Dokumen SK'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.skShareBtn}
                  onPress={handleShareSk}
                  activeOpacity={0.8}
                >
                  <Share2 size={16} color={Colors.primary} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            )}
          </Section>
        )}

        {/* UPLOAD FILE SKRIPSI (khusus approved / sk_issued) */}
        {(submission.status === 'approved' || submission.status === 'sk_issued') && (
          <Section style={styles.skripsiUploadCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.headerIconCircle}>
                <FileText size={20} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionHeading}>Upload File Skripsi</Text>
                <Text style={styles.sectionSubheading}>
                  Unggah berkas PDF skripsi Anda yang sudah jadi
                </Text>
              </View>
            </View>

            {uploadedSkripsi ? (
              <View style={styles.skripsiUploadedBox}>
                <View style={styles.skripsiFileRow}>
                  <View style={styles.skripsiFileIcon}>
                    <FileCheck size={22} color={Colors.primary} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.skripsiFileName} numberOfLines={1}>
                      {uploadedSkripsi.file_name}
                    </Text>
                    <Text style={styles.skripsiFileMeta}>
                      {formatSkripsiSize(uploadedSkripsi.size)}
                      {uploadedSkripsi.size ? ' • ' : ''}
                      {new Date(uploadedSkripsi.date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>
                <View style={styles.skripsiActionRow}>
                  <TouchableOpacity
                    style={styles.skripsiViewBtn}
                    onPress={handleViewUploadedSkripsi}
                    activeOpacity={0.8}
                  >
                    <ExternalLink size={15} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.skripsiViewBtnText}>Lihat File</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.skripsiReplaceBtn}
                    onPress={handleUploadSkripsi}
                    disabled={uploadingSkripsi}
                    activeOpacity={0.8}
                  >
                    <Upload size={15} color={Colors.primary} strokeWidth={2.2} />
                    <Text style={styles.skripsiReplaceBtnText}>
                      {uploadingSkripsi ? 'Mengupload...' : 'Ganti File'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.skripsiUploadBtn}
                onPress={handleUploadSkripsi}
                disabled={uploadingSkripsi}
                activeOpacity={0.8}
              >
                <View style={styles.skripsiUploadIcon}>
                  <Upload size={22} color={Colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.skripsiUploadTitle}>
                    {uploadingSkripsi ? 'Mengupload...' : 'Pilih File PDF Skripsi'}
                  </Text>
                  <Text style={styles.skripsiUploadSubtitle}>
                    File akan tersimpan di cloud dan bisa dibaca kapan saja
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </Section>
        )}

        {/* 1. STATUS PROGRESS TRACKER */}
        <Section style={styles.trackerCard}>
          <Text style={styles.sectionHeading}>Alur Proses Pengajuan</Text>

          <View style={styles.verticalStepper}>
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
                  {submission.options?.length ?? requiredTitleCount ?? 'Beberapa'} usulan judul dan latar belakang diajukan oleh Mahasiswa.
                </Text>
                <Text style={styles.vStepDate}>{formattedSubmittedDate}</Text>
              </View>
            </View>

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
                      <Text style={styles.vBadgeTextActive}>Sedang Diverifikasi</Text>
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
                {formattedVerificationDate && (
                  <Text style={styles.vStepDate}>Terverifikasi: {formattedVerificationDate}</Text>
                )}
              </View>
            </View>

            <View style={styles.vStepItem}>
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
                <View
                  style={[
                    styles.vStepLine,
                    currentStage >= 4 && styles.vStepLineActive,
                  ]}
                />
              </View>
              <View style={styles.vStepRight}>
                <View style={styles.vStepHeader}>
                  <Text style={styles.vStepTitle}>3. Penetapan & Pengesahan Kaprodi</Text>
                  {currentStage >= 3 && (
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
                  {currentStage >= 3 &&
                    `Pengesahan judul resmi dan penunjukan pembimbing oleh ${submission.kaprodiName || 'Ketua Program Studi'}.`}
                  {submission.status === 'waiting_kaprodi' &&
                    'Menunggu validasi akhir dan penetapan resmi oleh Kaprodi.'}
                  {currentStage === 1 &&
                    'Pengesahan akan diproses setelah lolos verifikasi Dosen Penilai.'}
                  {(submission.status === 'revision' || submission.status === 'rejected') &&
                    'Tahap pengesahan ditiadakan karena pengajuan tidak berlanjut.'}
                </Text>
                {formattedKaprodiDate ? (
                  <Text style={styles.vStepDate}>Disahkan: {formattedKaprodiDate}</Text>
                ) : null}
              </View>
            </View>

            {/* 4. TAHAP ADMINISTRASI & PENOMORAN SK (TU) */}
            <View style={styles.vStepItem}>
              <View style={styles.vStepLeft}>
                <View
                  style={[
                    styles.vStepCircle,
                    currentStage >= 5 && styles.vStepCircleCompleted,
                    (currentStage === 3 || currentStage === 4) && styles.vStepCircleActive,
                    (currentStage < 3 || submission.status === 'revision' || submission.status === 'rejected') &&
                      styles.vStepCircleInactive,
                  ]}
                >
                  {currentStage >= 5 ? (
                    <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.5} />
                  ) : currentStage === 3 || currentStage === 4 ? (
                    <FileCheck size={16} color={Colors.primary} strokeWidth={2.2} />
                  ) : (
                    <FileCheck size={16} color={Colors.textTertiary} strokeWidth={2} />
                  )}
                </View>
                <View
                  style={[
                    styles.vStepLine,
                    currentStage >= 5 && styles.vStepLineActive,
                  ]}
                />
              </View>
              <View style={styles.vStepRight}>
                <View style={styles.vStepHeader}>
                  <Text style={styles.vStepTitle}>4. Administrasi & Penomoran SK</Text>
                  {currentStage >= 5 && (
                    <View style={[styles.vStepBadge, styles.vBadgeSuccess]}>
                      <Text style={styles.vBadgeTextSuccess}>SK Selesai</Text>
                    </View>
                  )}
                  {submission.status === 'sk_process' && (
                    <View style={[styles.vStepBadge, styles.vBadgeWarning]}>
                      <Text style={styles.vBadgeTextWarning}>Proses TTD Dekan</Text>
                    </View>
                  )}
                  {submission.status === 'waiting_akademik' && (
                    <View style={[styles.vStepBadge, styles.vBadgeActive]}>
                      <Text style={styles.vBadgeTextActive}>Penomoran Surat</Text>
                    </View>
                  )}
                  {currentStage < 3 && (
                    <View style={[styles.vStepBadge, styles.vBadgeInactive]}>
                      <Text style={styles.vBadgeTextInactive}>Menunggu Kaprodi</Text>
                    </View>
                  )}
                  {(submission.status === 'revision' || submission.status === 'rejected') && (
                    <View style={[styles.vStepBadge, styles.vBadgeInactive]}>
                      <Text style={styles.vBadgeTextInactive}>Tidak Diproses</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.vStepDesc}>
                  {currentStage >= 5 &&
                    'Nomor SK resmi telah dicatat dalam sistem dan pengesahan Dekan selesai.'}
                  {submission.status === 'sk_process' &&
                    'Draf SK sedang dalam proses tanda tangan basah pimpinan fakultas (Dekan).'}
                  {submission.status === 'waiting_akademik' &&
                    'Berkas pengesahan masuk antrean Bagian Administrasi / TU untuk registrasi nomor SK resmi.'}
                  {currentStage < 3 &&
                    'Diproses oleh Bagian Akademik setelah penetapan dan persetujuan Kaprodi.'}
                  {(submission.status === 'revision' || submission.status === 'rejected') &&
                    'Tahap administrasi ditiadakan karena pengajuan tidak berlanjut.'}
                </Text>
                {formattedTuDate ? (
                  <Text style={styles.vStepDate}>Diproses: {formattedTuDate}</Text>
                ) : null}
              </View>
            </View>

            {/* 5. TAHAP SK RESMI TERBIT & BIMBINGAN AKTIF */}
            <View style={[styles.vStepItem, styles.vStepItemLast]}>
              <View style={styles.vStepLeft}>
                <View
                  style={[
                    styles.vStepCircle,
                    currentStage >= 5 && styles.vStepCircleCompleted,
                    currentStage < 5 && styles.vStepCircleInactive,
                  ]}
                >
                  {currentStage >= 5 ? (
                    <CheckCircle2 size={16} color="#FFFFFF" strokeWidth={2.5} />
                  ) : (
                    <Award size={16} color={Colors.textTertiary} strokeWidth={2} />
                  )}
                </View>
              </View>
              <View style={styles.vStepRight}>
                <View style={styles.vStepHeader}>
                  <Text style={styles.vStepTitle}>5. Penerbitan SK & Bimbingan</Text>
                  {currentStage >= 5 && (
                    <View style={[styles.vStepBadge, styles.vBadgeSuccess]}>
                      <Text style={styles.vBadgeTextSuccess}>SK Resmi Terbit</Text>
                    </View>
                  )}
                  {currentStage < 5 && (
                    <View style={[styles.vStepBadge, styles.vBadgeInactive]}>
                      <Text style={styles.vBadgeTextInactive}>Belum Terbit</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.vStepDesc}>
                  {currentStage >= 5
                    ? 'Surat Keputusan resmi telah diterbitkan oleh Akademik. Dokumen siap diunduh dan proses bimbingan skripsi dapat dimulai.'
                    : 'SK resmi dapat diunduh mahasiswa setelah seluruh rangkaian administrasi dan tanda tangan selesai.'}
                </Text>
                {formattedSkIssuedDate ? (
                  <Text style={styles.vStepDate}>Terbit: {formattedSkIssuedDate}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.statusDescriptionBox}>
            <Text style={styles.statusDescriptionText}>
              {submission.status === 'pending_lecturer' &&
                'Pengajuan Anda sedang dalam antrean pemeriksaan oleh Dosen Penilai untuk penentuan judul terbaik dan calon pembimbing.'}
              {submission.status === 'waiting_kaprodi' &&
                'Dosen Penilai telah memilih usulan judul dan menentukan Dosen Pembimbing. Menunggu validasi & penetapan resmi oleh Ketua Program Studi.'}
              {submission.status === 'waiting_akademik' &&
                'Pengajuan telah disahkan oleh Kaprodi! Berkas saat ini sedang dalam antrean Bagian Administrasi / TU untuk penomoran SK resmi.'}
              {submission.status === 'sk_process' &&
                'Nomor SK resmi telah diterbitkan. Berkas saat ini sedang dalam proses tanda tangan basah pimpinan fakultas (Dekan).'}
              {(submission.status === 'sk_issued' || submission.status === 'approved') &&
                'Selamat! SK Pengesahan Judul dan Dosen Pembimbing telah resmi terbit. Silakan unduh dokumen SK di atas dan mulai proses bimbingan.'}
              {submission.status === 'revision' &&
                'Usulan judul skripsi Anda perlu diperbaiki. Anda dapat mengajukan judul baru dari halaman Dashboard.'}
              {submission.status === 'rejected' &&
                'Usulan judul ini telah ditolak. Anda dapat membuat pengajuan baru melalui halaman Dashboard.'}
            </Text>
          </View>

          {(submission.status === 'revision' || submission.status === 'rejected') && (
            <View style={{ marginTop: 14 }}>
              <Button
                title={
                  hasActiveSubmission
                    ? 'Pengajuan Aktif Berjalan'
                    : 'Ajukan Ulang dengan Data Sama'
                }
                onPress={() =>
                  !hasActiveSubmission &&
                  router.push(`/submission/create?resubmit=${submission.$id}` as any)
                }
                variant="primary"
                disabled={hasActiveSubmission}
              />
              {hasActiveSubmission && (
                <Text style={styles.resubmitDisabledNote}>
                  Anda sudah memiliki pengajuan yang sedang diproses. Ajukan ulang
                  dapat dilakukan setelah pengajuan tersebut ditolak.
                </Text>
              )}
            </View>
          )}
        </Section>

        {/* 3. DETAIL DOSEN PEMBIMBING */}
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
                    {submission.status === 'approved' || submission.status === 'sk_issued'
                      ? 'Resmi ditetapkan dalam SK Pembimbing'
                      : submission.status === 'waiting_akademik' || submission.status === 'sk_process'
                      ? 'Ditetapkan Kaprodi (Dalam Proses Penerbitan SK)'
                      : 'Ditetapkan oleh Reviewer (Menunggu Pengesahan Final)'}
                  </Text>
                </View>
              </View>

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

              {submission.advisor2 && (
                <View style={[styles.advisorCard, { marginTop: 12 }]}>
                  <View style={styles.advisorTopRow}>
                    <Avatar
                      name={submission.advisor2.name}
                      size={54}
                      backgroundColor="#0284C7"
                    />
                    <View style={styles.advisorMainInfo}>
                      <View style={[styles.advisorRolePill, { backgroundColor: '#E0F2FE' }]}>
                        <Text style={[styles.advisorRolePillText, { color: '#0369A1' }]}>
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

        {/* 4. DAFTAR USULAN OPSI (PER CARD STACK - INDEPENDENT CARDS) */}
        {submission.options && submission.options.length > 0 ? (
          <View style={styles.independentStackContainer}>
            <View style={styles.sectionHeaderRow}>
              {/* <View style={[styles.headerIconCircle, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
                <BookOpen size={18} color={Colors.primary} strokeWidth={2.2} />
              </View> */}
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionHeading}>Daftar Usulan Opsi Judul Skripsi</Text>
                {/* <Text style={styles.sectionSubheading}>
                  Ketuk kartu opsi untuk melihat rincian rumusan masalah dan jurnal
                </Text> */}
              </View>
            </View>

            <View style={styles.stackCardsList}>
              {submission.options.map((opt) => {
                const isSelected = opt.is_selected_by_lecturer;
                const isExpanded = expandedOptions[opt.$id] || false;

                return (
                  <View
                    key={opt.$id}
                    style={[
                      styles.indCard,
                      isSelected && styles.indCardSelected,
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => toggleOptionExpansion(opt.$id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.indCardHeader}>
                        <View style={styles.indCardHeaderLeft}>
                          <View style={[styles.indBadge, isSelected && styles.indBadgeSelected]}>
                            <Text style={[styles.indBadgeText, isSelected && styles.indBadgeTextSelected]}>
                              {opt.option_number}
                            </Text>
                          </View>
                          <Text style={styles.indCardSubLabel}>OPSI JUDUL {opt.option_number}</Text>
                          {isSelected && (
                            <View style={styles.indSelectedTag}>
                              <Text style={styles.indSelectedTagText}>JUDUL TERPILIH</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.indChevronWrap}>
                          {isExpanded ? (
                            <ChevronUp size={18} color={Colors.primary} strokeWidth={2.2} />
                          ) : (
                            <ChevronDown size={18} color={Colors.textSecondary} strokeWidth={2.2} />
                          )}
                        </View>
                      </View>

                      <Text style={[styles.indCardTitle, isSelected && styles.indCardTitleSelected]}>
                        {opt.title}
                      </Text>
                    </TouchableOpacity>

                    {/* Expanded Detail Blocks */}
                    {isExpanded && (
                      <View style={styles.indExpandedContent}>
                        <View style={styles.indDivider} />

                        {/* Latar Belakang Masalah */}
                        <View style={styles.indSubCardBlock}>
                          <Text style={styles.indSubBlockTitle}>Latar Belakang Masalah:</Text>
                          <Text style={styles.indSubBlockText}>{opt.background}</Text>
                        </View>

                        {/* Jurnal Referensi */}
                        {opt.journal_title ? (
                          <View style={[styles.indSubCardBlock, { marginTop: 10 }]}>
                            <Text style={styles.indSubBlockTitle}>JURNAL REFERENSI</Text>
                            <Text style={styles.indJournalTitle}>{opt.journal_title}</Text>
                            {opt.journal_author ? (
                              <Text style={styles.indJournalAuthor}>
                                {opt.journal_author} {opt.journal_year ? `(${opt.journal_year})` : ''}
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

                        {/* Tabel Relevansi Penelitian */}
                        {(opt.relevance_variable || opt.relevance_methodology || opt.relevance_note) && (
                          <View style={styles.indRelevanceSection}>
                            <View style={styles.indRelevanceHeader}>
                              <TableProperties size={14} color={Colors.primary} strokeWidth={2.2} />
                              <Text style={styles.indRelevanceHeaderText}>Tabel Relevansi Penelitian</Text>
                            </View>

                            {opt.relevance_variable ? (
                              <View style={styles.indRelSubCard}>
                                <Text style={styles.indRelRowTitle}>Variabel Penelitian</Text>
                                <Text style={styles.indRelRowVal}>{opt.relevance_variable}</Text>
                              </View>
                            ) : null}

                            {opt.relevance_methodology ? (
                              <View style={[styles.indRelSubCard, { marginTop: 8 }]}>
                                <Text style={styles.indRelRowTitle}>Metodologi Jurnal</Text>
                                <Text style={styles.indRelRowVal}>{opt.relevance_methodology}</Text>
                              </View>
                            ) : null}

                            {opt.relevance_note ? (
                              <View style={[styles.indRelSubCard, { marginTop: 8 }]}>
                                <Text style={styles.indRelRowTitle}>Kesesuaian Topik</Text>
                                <Text style={styles.indRelRowVal}>{opt.relevance_note}</Text>
                              </View>
                            ) : null}
                          </View>
                        )}

                        {opt.revision_note && (
                          <View style={styles.flatNoteGroup}>
                            <Text style={styles.flatNoteLabel}>Catatan Penilai / Reviewer:</Text>
                            <Text style={styles.flatNoteText}>{opt.revision_note}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
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
                        ? 'Disahkan Kaprodi'
                        : log.action === 'MINTA_REVISI'
                        ? 'Permintaan Revisi Judul'
                        : log.action === 'DITOLAK'
                        ? 'Ditolak'
                        : log.action === 'REVISI_PENGAJUAN'
                        ? 'Revisi Pengajuan'
                        : log.action === 'PENGAJUAN_MAHASISWA'
                        ? 'Pengajuan Mahasiswa'
                        : log.action === 'UPLOAD_SKRSIPSI'
                        ? 'Upload SK / File Skripsi'
                        : log.action === 'PENGESAHAN_KAPRODI' || log.action === 'APPROVAL_KAPRODI'
                        ? 'Disahkan Kaprodi'
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

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.skDocHeader}>
                <View style={styles.skDocLogo}>
                  <GraduationCap size={28} color={Colors.primary} strokeWidth={2.4} />
                </View>
                <Text style={styles.skDocInstitution}>UNIVERSITAS MUHAMMADIYAH ACEH</Text>
                <Text style={styles.skDocTitle}>SURAT KEPUTUSAN PENGESAHAN</Text>
                <Text style={styles.skDocSubtitle}>
                  PENETAPAN JUDUL SKRIPSI DAN PENGANGKATAN DOSEN PEMBIMBING
                </Text>
                <View style={styles.skDocDoubleLine} />
              </View>

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

              <View style={styles.skDocSection}>
                <Text style={styles.skDocSectionTitle}>I. IDENTITAS PENGAJUAN</Text>
                <View style={styles.skDocRow}>
                  <Text style={styles.skDocColLabel}>No. Dokumen:</Text>
                  <Text style={styles.skDocColValue}>
                    {submission.surat?.no_dokumen ||
                      submission.surat?.noDokumen ||
                      `SPSM-${submission.$id.toUpperCase()}`}
                  </Text>
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

              <View style={styles.skDocSection}>
                <Text style={styles.skDocSectionTitle}>II. JUDUL SKRIPSI YANG DISAHKAN</Text>
                <View style={styles.skDocTitleBox}>
                  <Text style={styles.skDocChosenTitle}>
                    &ldquo;{selectedOption?.title || 'Judul skripsi terpilih'}&rdquo;
                  </Text>
                </View>
              </View>

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

              <View style={styles.skDocSignSection}>
                <Text style={styles.skDocSignCity}>Disahkan secara digital oleh:</Text>
                <Text style={styles.skDocSignRole}>Ketua Program Studi</Text>
                <View style={styles.skDocStampBox}>
                  <CheckCircle2 size={16} color={Colors.primary} strokeWidth={2.4} />
                  <Text style={styles.skDocStampText}>DIGITALLY VERIFIED & APPROVED</Text>
                </View>
                <Text style={styles.skDocSignName}>{submission.kaprodiName || 'Ketua Program Studi'}</Text>
                {formattedApprovalDate && (
                  <Text style={styles.skDocSignDate}>{formattedApprovalDate}</Text>
                )}
              </View>
            </ScrollView>

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
  skripsiUploadCard: {
    marginBottom: 4,
  },
  skripsiUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  skripsiUploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  skripsiUploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  skripsiUploadSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  skripsiUploadedBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skripsiFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  skripsiFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  skripsiFileName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  skripsiFileMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  skripsiActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skripsiViewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  skripsiViewBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  skripsiReplaceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  skripsiReplaceBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
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
  headerCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
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
  headerSkId: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#059669',
    fontWeight: '700',
    marginTop: 2,
  },
  headerBadgeAbsolute: {
    position: 'absolute',
    top: -10,
    right: 10,
    zIndex: 10,
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
  dateContainer: {
    gap: 8,
  },
  dateItem: {
    gap: 2,
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
  headerSkActionContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSkDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerSkDownloadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSkPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerSkPreviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
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
    marginBottom: 15,
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
    marginTop: 10,
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
    position: 'absolute',
    top: 20,
    left:0,
  },
  vBadgeSuccess: {
    backgroundColor: '#EFF6FF',
  },
  vBadgeTextSuccess: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
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
  // Independent Stack Cards Styles matching reference images exactly
  independentStackContainer: {
    marginBottom: 16,
  },
  stackCardsList: {
    marginTop: -12,
    gap: 14,
  },
  indCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  indCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  indCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  indCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  indBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indBadgeSelected: {
    backgroundColor: Colors.primary,
  },
  indBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  indBadgeTextSelected: {
    color: '#FFFFFF',
  },
  indCardSubLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  indSelectedTag: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  indSelectedTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  indChevronWrap: {
    padding: 2,
  },
  indCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  indCardTitleSelected: {
    color: '#0F172A',
    fontWeight: '800',
  },
  indExpandedContent: {
    marginTop: 14,
  },
  indDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  indSubCardBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  indSubBlockTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  indSubBlockText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  indJournalTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  indJournalAuthor: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    marginBottom: 10,
  },
  btnPdfSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  btnPdfSmallText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  indRelevanceSection: {
    marginTop: 12,
  },
  indRelevanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  indRelevanceHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  indRelSubCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  indRelRowTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  indRelRowVal: {
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 18,
  },
  flatNoteGroup: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 12,
  },
  flatNoteLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  flatNoteText: {
    fontSize: 12.5,
    color: '#78350F',
    marginTop: 4,
    lineHeight: 18,
  },
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
  skOfficialCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F1F5F9',
  },
  skOfficialBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  skUrutanBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skUrutanBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  skNumberBox: {
    backgroundColor: '#F8FAFC',
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
    color: Colors.primary,
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
    backgroundColor: Colors.primary,
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
    color: Colors.primary,
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
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginVertical: 10,
  },
  skDocStampText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
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
  resubmitDisabledNote: {
    fontSize: 11.5,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});