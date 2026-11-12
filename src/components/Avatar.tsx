import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import { User } from 'lucide-react-native';
import { Colors } from '@/theme/theme';

type AvatarProps = {
  name?: string;
  source?: string | null;
  size?: number;
  backgroundColor?: string;
  borderColor?: string;
  /** Tampilkan icon User (bg putih, icon abu-abu) saat tidak ada foto, menggantikan inisial */
  iconFallback?: boolean;
  style?: ViewStyle;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  name = '?',
  source,
  size = 46,
  backgroundColor = Colors.primary,
  borderColor,
  iconFallback = false,
  style,
}) => {
  const [imageError, setImageError] = useState(false);

  const showImage = !!source && !imageError;
  const fallbackBg = iconFallback ? '#FFFFFF' : backgroundColor;
  const iconColor = iconFallback ? '#94A3B8' : undefined;
  const textColor = iconFallback ? '#94A3B8' : '#ffffff';

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: showImage ? 'transparent' : fallbackBg,
          borderWidth: borderColor ? 2 : 0,
          borderColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: source! }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImageError(true)}
          resizeMode="cover"
        />
      ) : iconFallback ? (
        <User size={size * 0.52} color={iconColor} strokeWidth={2} />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.4, color: textColor }]}>
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
