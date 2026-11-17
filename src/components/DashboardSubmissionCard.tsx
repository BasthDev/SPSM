import { Section, StatusBadge } from '@/components';
import type { ThesisSubmission } from '@/models/types';
import { Colors } from '@/theme/theme';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  FileEdit,
  GraduationCap,
  RefreshCcw,
  Trash2,
} from 'lucide-react-native';
import { memo } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface DashboardSubmissionCardProps {
  sub: ThesisSubmission;
  /** Nomor urut pengajuan, contoh: 1, 2, atau "Draf" */
  number: number | string;
  expanded?: boolean;
  /** True jika ada pengajuan lain yang sedang aktif berjalan */
  resubmitDisabled?: boolean;
  onToggleExpand?: (cardId: string) => void;
  onDeleteDraft?: () => void;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function DashboardSubmissionCardInner({
  sub,
  number,
  resubmitDisabled = false,
  onDeleteDraft,
}: DashboardSubmissionCardProps) {
  const router = useRouter();

  const isDraft = sub.status === 'drafting' || sub.$id === 'draft';

  // 1. Nomor Dokumen
  const docNumber = isDraft
    ? 'DRAF-LOKAL'
    : sub.surat?.no_dokumen ||
      sub.surat?.noDokumen ||
      `SPSM_${sub.$id.toUpperCase().slice(0, 12)}`;

  // 2. Nomor SK (jika sudah terbit SK)
  const skNumber = sub.nomor_surat || sub.surat?.nomor_surat || sub.surat?.nomorSurat || null;

  // 3. Tanggal Pengajuan
  const formattedSubmittedDate = formatDate(sub.submitted_at);

  // 4. Tanggal SK Terbit (hanya jika SK sudah terbit)
  const skDateRaw = sub.sk_generated_at || sub.kaprodiApprovalDate || null;
  const formattedApprovalDate = skNumber && skDateRaw ? formatDate(skDateRaw) : null;

  // 5. Status Label (sama persis dengan halaman detail)
  const statusLabel =
    sub.status === 'sk_issued' || sub.status === 'approved'
      ? 'SK Resmi Terbit'
      : sub.status === 'sk_process'
      ? 'Proses TTD Dekan'
      : sub.status === 'waiting_akademik'
      ? 'Menunggu Administrasi TU'
      : sub.status === 'waiting_kaprodi'
      ? 'Pleno Kaprodi'
      : sub.status === 'revision'
      ? 'Perlu Revisi'
      : sub.status === 'rejected'
      ? 'Ditolak'
      : sub.status === 'drafting'
      ? 'Draf'
      : 'Menunggu Review';

  const canResubmit = sub.status === 'revision' || sub.status === 'rejected';

  const handleCardPress = () => {
    if (isDraft) {
      router.push('/submission/create' as any);
    } else {
      router.push(`/submission/${sub.$id}` as any);
    }
  };

  const handleConfirmDelete = () => {
    if (!isDraft) return;
    Alert.alert(
      'Hapus Draf Pengajuan',
      'Apakah Anda yakin ingin membatalkan dan menghapus draf pengajuan ini? Pengajuan baru akan kembali dibuka.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Hapus',
          style: 'destructive',
          onPress: () => {
            onDeleteDraft?.();
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      onLongPress={isDraft ? handleConfirmDelete : undefined}
      delayLongPress={isDraft ? 3000 : undefined}
      activeOpacity={0.85}
      style={styles.cardTouchable}
    >
      <Section style={styles.headerCard}>
        {/* Top Row: Icon, Judul Pengajuan, No. Dokumen, No. SK */}
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftCol}>
            <View
              style={[
                styles.headerIconBox,
                isDraft && { backgroundColor: '#FEF3C7' },
              ]}
            >
              {isDraft ? (
                <FileEdit size={20} color="#B45309" strokeWidth={2.2} />
              ) : (
                <GraduationCap size={20} color={Colors.primary} strokeWidth={2.2} />
              )}
            </View>
            <View style={styles.headerTexts}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isDraft ? 'Draf Pengajuan Skripsi' : `Pengajuan Skripsi #${number}`}
              </Text>
              <Text style={styles.headerId} numberOfLines={1} ellipsizeMode="middle">
                NO. DOKUMEN: {docNumber}
              </Text>
              {skNumber ? (
                <Text style={styles.headerSkId} numberOfLines={1} ellipsizeMode="middle">
                  NO. SK: {skNumber}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Status Badge Absolute di pojok kanan atas */}
        <View style={styles.headerBadgeAbsolute}>
          <StatusBadge status={sub.status} size="sm" />
        </View>

        {/* Divider */}
        <View style={styles.headerDivider} />

        {/* Meta Row: Tanggal Pengajuan, Tanggal SK Terbit (jika ada), & Status */}
        <View style={styles.headerMetaRow}>
          <View style={styles.headerMetaItem}>
            <View style={styles.dateContainer}>
              <View style={styles.dateItem}>
                <Text style={styles.headerMetaLabel}>
                  {isDraft ? 'Tanggal Disimpan' : 'Tanggal Pengajuan'}
                </Text>
                <Text style={styles.headerMetaValue}>{formattedSubmittedDate}</Text>
              </View>

              {formattedApprovalDate ? (
                <View style={styles.dateItem}>
                  <Text style={styles.headerMetaLabel}>Tanggal SK Terbit</Text>
                  <Text style={[styles.headerMetaValue, styles.skDateHighlight]}>
                    {formattedApprovalDate}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.headerMetaItem}>
            <Text style={styles.headerMetaLabel}>Status</Text>
            <Text style={styles.headerMetaValueHL}>{statusLabel}</Text>
          </View>
        </View>

        {/* Resubmit shortcut (jika revisi/ditolak) */}
        {canResubmit && (
          <TouchableOpacity
            onPress={() =>
              !resubmitDisabled &&
              router.push(`/submission/create?resubmit=${sub.$id}` as any)
            }
            activeOpacity={0.75}
            disabled={resubmitDisabled}
            style={[
              styles.resubmitButton,
              resubmitDisabled && styles.resubmitButtonDisabled,
            ]}
          >
            <RefreshCcw size={14} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.resubmitButtonText}>
              {resubmitDisabled
                ? 'Pengajuan Aktif Berjalan'
                : 'Ajukan Ulang dengan Data Sama'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Footer Card */}
        <View style={styles.cardFooter}>
          {isDraft ? (
            <View style={styles.draftFooterBlock}>
              <View style={styles.draftButtonsRow}>
                <TouchableOpacity
                  onPress={handleCardPress}
                  activeOpacity={0.8}
                  style={styles.continueDraftBtn}
                >
                  <Text style={styles.continueDraftBtnText}>Lanjutkan Draf</Text>
                  <ChevronRight size={14} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmDelete}
                  activeOpacity={0.7}
                  style={styles.deleteDraftBtn}
                >
                  <Trash2 size={13} color="#DC2626" strokeWidth={2.2} />
                  <Text style={styles.deleteDraftBtnText}>Hapus</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.draftHintText}>
                Tahan 3 detik untuk menghapus draf
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleCardPress}
              activeOpacity={0.7}
              style={styles.detailLinkRow}
            >
              <Text style={styles.detailLinkText}>Buka Detail Pengajuan & SK</Text>
              <ChevronRight size={15} color={Colors.primary} strokeWidth={2.4} />
            </TouchableOpacity>
          )}
        </View>
      </Section>
    </TouchableOpacity>
  );
}

export const DashboardSubmissionCard = memo(DashboardSubmissionCardInner);

const styles = StyleSheet.create({
  cardTouchable: {
    marginBottom: 4,
  },
  headerCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
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
    paddingRight: 80, // Ruang agar teks tidak tertabrak status badge
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
  skDateHighlight: {
    color: '#047857',
    fontWeight: '700',
  },
  headerMetaValueHL: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  resubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  resubmitButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  resubmitButtonText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  draftFooterBlock: {
    gap: 4,
  },
  draftButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  continueDraftBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  continueDraftBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteDraftBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  draftHintText: {
    fontSize: 10.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
});
