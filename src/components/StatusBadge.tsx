import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/theme/theme';

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
    bg: Colors.warning,
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  waiting_kaprodi: {
    label: 'Menunggu Kaprodi',
    bg: Colors.primary,
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  approved: {
    label: 'Disetujui',
    bg: Colors.primary,
    text: '#FFFFFF',
    dot: '#FFFFFF',
  },
  revision: {
    label: 'Perlu Revisi',
    bg: Colors.warning,
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
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
