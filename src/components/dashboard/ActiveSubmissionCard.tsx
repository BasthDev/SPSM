import { StatusBadge } from '@/components';
import type { ThesisSubmission } from '@/models/types';
import { Colors } from '@/theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, FileText } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  submission: ThesisSubmission;
};

const STATUS_LABEL: Record<string, string> = {
  sk_issued: 'SK Resmi Terbit',
  approved: 'SK Resmi Terbit',
  sk_process: 'Proses TTD Dekan',
  waiting_akademik: 'Menunggu Administrasi TU',
  waiting_kaprodi: 'Pleno Kaprodi',
  pending_lecturer: 'Menunggu Review Dosen',
  revision: 'Perlu Revisi',
  rejected: 'Ditolak',
  drafting: 'Draf',
};

const STATUS_GRADIENT: Record<string, [string, string]> = {
  sk_issued: ['#059669', '#047857'],
  approved: ['#059669', '#047857'],
  sk_process: ['#C2410C', '#9A3412'],
  waiting_akademik: ['#6D28D9', '#5B21B6'],
  waiting_kaprodi: ['#1D4ED8', '#1E40AF'],
  pending_lecturer: ['#B45309', '#92400E'],
  revision: ['#B45309', '#92400E'],
  rejected: ['#DC2626', '#B91C1C'],
  drafting: ['#475569', '#334155'],
};

function fmtDate(iso?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Header card untuk submission aktif — gradient per status,
 * menampilkan no. dokumen, no. SK, tanggal, dan status.
 */
export function ActiveSubmissionCard({ submission: sub }: Props) {
  const router = useRouter();
  const gradient = STATUS_GRADIENT[sub.status] ?? ['#0A4C8F', '#0369A1'];
  const statusLabel = STATUS_LABEL[sub.status] ?? 'Menunggu Review';
  const docNo =
    sub.surat?.no_dokumen || sub.surat?.noDokumen ||
    `SPSM_${sub.$id.toUpperCase().slice(0, 12)}`;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/submission/${sub.$id}` as any)}
      activeOpacity={0.85}
      style={styles.wrap}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Baris atas: icon + judul + badge status */}
        <View style={styles.topRow}>
          <View style={styles.iconCircle}>
            <FileText size={20} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.title} numberOfLines={1}>Pengajuan Skripsi Aktif</Text>
            <Text style={styles.docNo} numberOfLines={1} ellipsizeMode="middle">
              {docNo}
            </Text>
            {sub.nomor_surat ? (
              <Text style={styles.skNo} numberOfLines={1} ellipsizeMode="middle">
                NO. SK: {sub.nomor_surat}
              </Text>
            ) : null}
          </View>
          <View style={styles.badgeWrap}>
            <StatusBadge status={sub.status} size="sm" />
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Meta: tanggal + status label */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Diajukan</Text>
            <Text style={styles.metaValue}>{fmtDate(sub.submitted_at)}</Text>
          </View>
          {sub.kaprodiApprovalDate ? (
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Disahkan</Text>
              <Text style={styles.metaValue}>{fmtDate(sub.kaprodiApprovalDate)}</Text>
            </View>
          ) : null}
          <View style={styles.metaColRight}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.85)" strokeWidth={2.4} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  card: {
    borderRadius: 20,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  docNo: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    fontWeight: '600',
  },
  skNo: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 2,
    fontWeight: '700',
  },
  badgeWrap: {
    alignSelf: 'flex-start',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  metaCol: {
    flex: 1,
  },
  metaColRight: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  statusText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
});
