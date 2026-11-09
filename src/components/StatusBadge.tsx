import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

export type BadgeStatus =
  | 'pending_lecturer'
  | 'waiting_kaprodi'
  | 'approved'
  | 'revision'
  | 'rejected';

type StatusBadgeProps = {
  status: BadgeStatus;
  size?: 'sm' | 'md';
  style?: ViewStyle;
};

const STATUS_CONFIG: Record<BadgeStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending_lecturer: {
    label: 'Menunggu Review',
    bg: '#FEF3C7',
    text: '#B45309',
    dot: '#F59E0B',
  },
  waiting_kaprodi: {
    label: 'Menunggu Kaprodi',
    bg: '#E0F2FE',
    text: '#0369A1',
    dot: '#0284C7',
  },
  approved: {
    label: 'Disetujui',
    bg: '#D1FAE5',
    text: '#047857',
    dot: '#10B981',
  },
  revision: {
    label: 'Perlu Revisi',
    bg: '#FEE2E2',
    text: '#B91C1C',
    dot: '#EF4444',
  },
  rejected: {
    label: 'Ditolak',
    bg: '#F3F4F6',
    text: '#4B5563',
    dot: '#6B7280',
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
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
