import { Section, StatusBadge } from '@/components';
import type { ThesisSubmission } from '@/models/types';
import { Colors } from '@/theme/theme';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  RefreshCcw,
} from 'lucide-react-native';
import { memo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface DashboardSubmissionCardProps {
  sub: ThesisSubmission;
  /** Display number, e.g. "Pengajuan Skripsi #3" */
  number: number;
  expanded: boolean;
  /** True when another submission is currently active (blocks resubmit) */
  resubmitDisabled: boolean;
  onToggleExpand: (cardId: string) => void;
}

function DashboardSubmissionCardInner({
  sub,
  number,
  expanded,
  resubmitDisabled,
  onToggleExpand,
}: DashboardSubmissionCardProps) {
  const router = useRouter();

  const dateStr = new Date(sub.submitted_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const canResubmit = sub.status === 'revision' || sub.status === 'rejected';

  // Warna aksen kiri card — selaras dengan StatusBadge
  const STATUS_ACCENT: Record<string, string> = {
    drafting: '#475569',
    pending_lecturer: '#B45309',
    waiting_kaprodi: '#1D4ED8',
    waiting_akademik: '#6D28D9',
    sk_process: '#C2410C',
    sk_issued: '#047857',
    approved: '#047857',
    revision: '#B45309',
    rejected: '#DC2626',
    approved_lecturer: '#1D4ED8',
    pending_kaprodi: '#1D4ED8',
  };
  const accentColor = STATUS_ACCENT[sub.status] ?? '#94A3B8';

  return (
    <TouchableOpacity
      onPress={() => router.push(`/submission/${sub.$id}` as any)}
      activeOpacity={0.7}
    >
      <Section
        style={[
          styles.submissionCard,
          { borderLeftWidth: 4, borderLeftColor: accentColor },
        ]}
      >
        {/* Status Badge - Absolute Position */}
        <View style={styles.cardBadgeAbsolute}>
          <StatusBadge status={sub.status} size="sm" />
        </View>

        {/* Top Row: Title and Status */}
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Pengajuan Skripsi #{number}</Text>
          <View style={styles.cardHeaderRight}>
            <TouchableOpacity
              onPress={() => onToggleExpand(sub.$id)}
              activeOpacity={0.7}
              style={styles.expandButton}
            >
              {expanded ? (
                <ChevronUp size={18} color={Colors.primary} strokeWidth={2.5} />
              ) : (
                <ChevronDown size={18} color={Colors.textTertiary} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Document Info Section (always visible) */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>No. Dokumen:</Text>
            <Text style={[styles.infoValue, styles.infoValueMono]}>
              {sub.surat?.no_dokumen ||
                sub.surat?.noDokumen ||
                `SPSM_${sub.$id.toUpperCase().slice(0, 12)}`}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tanggal Diajukan:</Text>
            <Text style={styles.infoValue}>{dateStr}</Text>
          </View>
          {sub.kaprodiApprovalDate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tanggal Disahkan:</Text>
              <Text style={styles.infoValue}>
                {new Date(sub.kaprodiApprovalDate).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
          {sub.nomor_surat && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>No. SK:</Text>
              <Text style={[styles.infoValue, styles.infoValueSuccess, styles.infoValueMono]}>
                {sub.nomor_surat}
              </Text>
            </View>
          )}
        </View>

        {/* Collapsible Section: Title & Advisor */}
        {expanded && (
          <>
            <View style={styles.cardDivider} />

            {/* Title Display Section */}
            <View style={styles.titleSection}>
              {sub.status === 'pending_lecturer' && sub.options && sub.options.length > 0 ? (
                /* Case 1: Show all 3 titles when pending review */
                <View>
                  <Text style={styles.sectionLabel}>{sub.options?.length ?? 0} Usulan Judul Dalam Penelaahan:</Text>
                  {sub.options.map((opt) => (
                    <View key={opt.$id} style={styles.listCardOptRow}>
                      <View style={styles.listCardOptBadge}>
                        <Text style={styles.listCardOptBadgeText}>#{opt.option_number}</Text>
                      </View>
                      <Text style={styles.listCardOptText} numberOfLines={2}>
                        {opt.title}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : sub.status === 'revision' || sub.status === 'rejected' ? (
                /* Case 3: Show which title has revision/rejection notes */
                <View>
                  <Text style={styles.sectionLabel}>Usulan Judul & Catatan Evaluasi:</Text>
                  {sub.options && sub.options.length > 0 ? (
                    sub.options.map((opt) => (
                      <View key={opt.$id} style={styles.revisionOptionRow}>
                        <View style={styles.revisionBadge}>
                          <Text style={styles.revisionBadgeText}>#{opt.option_number}</Text>
                        </View>
                        <View style={styles.revisionContent}>
                          <Text style={styles.revisionTitle} numberOfLines={2}>
                            {opt.title}
                          </Text>
                          {opt.revision_note && (
                            <View style={styles.revisionNoteBox}>
                              <AlertTriangle size={11} color="#D97706" strokeWidth={2} />
                              <Text style={styles.revisionNoteText} numberOfLines={2}>
                                {opt.revision_note}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.infoValue}>Judul tidak tersedia</Text>
                  )}
                </View>
              ) : (
                /* Case 2: Show 1 selected title if approved or waiting kaprodi */
                <View>
                  <Text style={styles.sectionLabel}>Judul Yang Disetujui:</Text>
                  <Text style={styles.titleValue}>
                    {sub.selectedOption?.title || sub.options?.[0]?.title || 'Judul Skripsi'}
                  </Text>
                </View>
              )}

              {/* Dosen Pembimbing Section */}
              {sub.status !== 'revision' && sub.status !== 'rejected' && (
                <View style={styles.advisorSection}>
                  <Text style={styles.sectionLabel}>Dosen Pembimbing:</Text>
                  {sub.advisor ? (
                    <View style={styles.advisorInfoRow}>
                      <View style={styles.advisorBadge}>
                        <Text style={styles.advisorBadgeText}>P1</Text>
                      </View>
                      <View style={styles.advisorDetails}>
                        <Text style={styles.advisorName}>{sub.advisor.name}</Text>
                        <Text style={styles.advisorNip}>NIP: {sub.advisor.nip}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.infoValue, { color: Colors.warning }]}>
                      Sedang Menunggu Plotting
                    </Text>
                  )}
                  {sub.advisor2 && (
                    <View style={[styles.advisorInfoRow, { marginTop: 8 }]}>
                      <View style={styles.advisorBadge}>
                        <Text style={styles.advisorBadgeText}>P2</Text>
                      </View>
                      <View style={styles.advisorDetails}>
                        <Text style={styles.advisorName}>{sub.advisor2.name}</Text>
                        <Text style={styles.advisorNip}>NIP: {sub.advisor2.nip}</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {/* Resubmit shortcut — disabled jika ada pengajuan aktif lain */}
        {canResubmit && (
          <TouchableOpacity
            onPress={() =>
              !resubmitDisabled &&
              router.push(`/submission/create?resubmit=${sub.$id}` as any)
            }
            activeOpacity={0.7}
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

        {/* Card Action Link */}
        <TouchableOpacity
          onPress={() => router.push(`/submission/${sub.$id}` as any)}
          activeOpacity={0.7}
        >
          <View style={styles.cardFooter}>
            <Text style={styles.detailLinkText}>Buka Detail Pengajuan & SK</Text>
            <ChevronRight size={15} color={Colors.primary} strokeWidth={2.4} />
          </View>
        </TouchableOpacity>
      </Section>
    </TouchableOpacity>
  );
}

export const DashboardSubmissionCard = memo(DashboardSubmissionCardInner);

const styles = StyleSheet.create({
  submissionCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  cardBadgeAbsolute: {
    position: 'absolute',
    top: -10,
    right: 10,
    zIndex: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  infoSection: {
    marginBottom: 12,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    minWidth: 80,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    textAlign: 'right',
  },
  infoValueMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoValueSuccess: {
    color: '#059669',
  },
  titleSection: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  titleValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 20,
  },
  advisorSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  advisorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  advisorBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  advisorBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  advisorDetails: {
    flex: 1,
  },
  advisorName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  advisorNip: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  revisionOptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  revisionBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 1,
  },
  revisionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  revisionContent: {
    flex: 1,
  },
  revisionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  revisionNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  revisionNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  listCardOptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  listCardOptBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 1,
  },
  listCardOptBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  listCardOptText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 16,
  },
  resubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
});
