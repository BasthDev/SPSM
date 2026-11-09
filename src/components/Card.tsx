import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors } from '@/theme/theme';

type CardVariant = 'default' | 'elevated' | 'outlined';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: number;
  borderRadius?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  variant = 'default',
  padding = 18,
  borderRadius = 20,
  onPress,
  style,
}) => {
  const variantStyle: ViewStyle = {
    default: {
      borderWidth: 1,
      borderColor: Colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 2,
    },
    elevated: {
      shadowColor: '#0A4C8F',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 5,
    },
    outlined: {
      borderWidth: 1.5,
      borderColor: Colors.border,
    },
  }[variant];

  const cardStyle: StyleProp<ViewStyle> = [
    styles.base,
    { backgroundColor: Colors.card },
    variantStyle,
    { padding, borderRadius },
    style,
  ];

  const content = (
    <>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.82}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{content}</View>;
};

const styles = StyleSheet.create({
  base: {
    marginVertical: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
});
