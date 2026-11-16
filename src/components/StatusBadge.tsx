import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/theme/theme';
import type { SubmissionStatus } from '@/models/types';

export type BadgeStatus = SubmissionStatus;

type StatusBadgeProps = {
  status: BadgeStatus;
  size?: 'sm' | 'md';
  style?: ViewStyle;
};

/**
 * Soft badge: background tint terang + teks & dot warna solid.
 * `accent` = warna utama (dot + teks), `soft` = latar tint.
 */
const STATUS_CONFIG: Record<string, { label: string; accent: string; soft: string }> = {
  drafting: {
    label: 'Draf',
    accent: '#475569',
    soft: '#F1F5F9',
  },
  pending_lecturer: {
    label: 'Menunggu Review',
    accent: '#B45309',
    soft: '#FEF3C7',
  },
  waiting_kaprodi: {
    label: 'Pleno Kaprodi',
    accent: '#1D4ED8',
    soft: '#DBEAFE',
  },
  waiting_akademik: {
    label: 'Menunggu Administrasi TU',
    accent: '#6D28D9',
    soft: '#F3E8FF',
  },
  sk_process: {
    label: 'Proses TTD Dekan',
    accent: '#C2410C',
    soft: '#FFEDD5',
  },
  sk_issued: {
    label: 'SK Resmi Terbit',
    accent: '#047857',
    soft: '#D1FAE5',
  },
  approved: {
    label: 'SK Resmi Terbit',
    accent: '#047857',
    soft: '#D1FAE5',
  },
  revision: {
    label: 'Perlu Revisi',
    accent: '#B45309',
    soft: '#FEF3C7',
  },
  rejected: {
    label: 'Ditolak',
    accent: '#DC2626',
    soft: '#FEE2E2',
  },
  // Legacy aliases (normalized server-side, kept for safety)
  approved_lecturer: {
    label: 'Pleno Kaprodi',
    accent: '#1D4ED8',
    soft: '#DBEAFE',
  },
  pending_kaprodi: {
    label: 'Pleno Kaprodi',
    accent: '#1D4ED8',
    soft: '#DBEAFE',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', style }) => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_lecturer;

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.soft },
        isSmall && { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
        style,
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: config.accent },
          isSmall && { width: 5, height: 5, borderRadius: 2.5 },
        ]}
      />
      <Text
        style={[
          styles.text,
          { color: config.accent },
          isSmall && { fontSize: 11, fontWeight: '700' },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
export default StatusBadge;
