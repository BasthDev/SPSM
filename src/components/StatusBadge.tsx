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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  drafting: {
    label: 'Draf',
    bg: '#64748B',
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  pending_lecturer: {
    label: 'Menunggu Review',
    bg: Colors.warning,
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  waiting_kaprodi: {
    label: 'Pleno Kaprodi',
    bg: '#2563EB',
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  waiting_akademik: {
    label: 'Menunggu Administrasi TU',
    bg: '#7C3AED',
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  sk_process: {
    label: 'Proses TTD Dekan',
    bg: '#EA580C',
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  sk_issued: {
    label: 'SK Resmi Terbit',
    bg: '#059669',
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  approved: {
    label: 'Disetujui',
    bg: '#059669',
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  revision: {
    label: 'Perlu Revisi',
    bg: '#D97706',
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  rejected: {
    label: 'Ditolak',
    bg: Colors.error,
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', style }) => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_lecturer;

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg },
        isSmall && { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
        style,
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: config.dot },
          isSmall && { width: 5, height: 5, borderRadius: 2.5 },
        ]}
      />
      <Text
        style={[
          styles.text,
          { color: config.text },
          isSmall && { fontSize: 11, fontWeight: '600' },
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
    fontWeight: '500',
  },
});
export default StatusBadge;
