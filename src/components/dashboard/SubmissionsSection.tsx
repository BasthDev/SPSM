import { Button, EmptyState } from '@/components';
import { DashboardSubmissionCard } from '@/components/DashboardSubmissionCard';
import type { ThesisSubmission } from '@/models/types';
import { Colors } from '@/theme/theme';
import { useRouter } from 'expo-router';
import { FileText } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  submissions: ThesisSubmission[];
  activeSubmission: ThesisSubmission | null;
  expandedCards: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  canSubmitNew: boolean;
  requiredTitleCount: number;
};

/** Section "Riwayat Pengajuan" — header + list kartu + empty state. */
export function SubmissionsSection({
  submissions,
  activeSubmission,
  expandedCards,
  onToggleExpand,
  canSubmitNew,
  requiredTitleCount,
}: Props) {
  const router = useRouter();

  return (
    <View>
      {/* Section Header */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <View style={styles.sectionIconBox}>
            <FileText size={18} color={Colors.primary} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Riwayat Pengajuan</Text>
            <Text style={styles.sectionSubtitle}>Daftar dan status terkini pengajuan skripsi Anda</Text>
          </View>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{submissions.length}</Text>
        </View>
      </View>

      {/* List */}
      {submissions.length === 0 ? (
        <EmptyState
          title="Belum Ada Pengajuan"
          subtitle={
            canSubmitNew
              ? `Anda belum memiliki riwayat pengajuan judul. Klik tombol di atas untuk mengajukan ${requiredTitleCount} usulan judul skripsi.`
              : 'Belum ada riwayat pengajuan judul skripsi pada akun Anda.'
          }
          icon={<FileText size={32} color={Colors.primary} strokeWidth={2} />}
          action={
            canSubmitNew ? (
              <Button
                title="Mulai Pengajuan Baru"
                onPress={() => router.push('/submission/create' as any)}
                variant="primary"
                size="sm"
                style={{ marginTop: 8 }}
              />
            ) : undefined
          }
        />
      ) : (
        submissions.map((sub, index) => (
          <DashboardSubmissionCard
            key={sub.$id}
            sub={sub}
            number={submissions.length - index}
            expanded={Boolean(expandedCards[sub.$id])}
            resubmitDisabled={Boolean(activeSubmission)}
            onToggleExpand={onToggleExpand}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  countBadge: {
    backgroundColor: '#E0F2FE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.primary,
  },
});
