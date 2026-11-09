import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import { Colors } from '@/theme/theme';

type AvatarProps = {
  name?: string;
  source?: string | null;
  size?: number;
  backgroundColor?: string;
  borderColor?: string;
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
  style,
}) => {
  const [imageError, setImageError] = useState(false);

  const showImage = !!source && !imageError;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: showImage ? 'transparent' : backgroundColor,
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
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.4 }]}>
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
