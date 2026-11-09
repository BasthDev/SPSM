import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Colors } from '@/theme/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'google' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = true,
  style,
  textStyle,
}) => {
  const isDisabled = disabled || loading;

  const getColors = () => {
    if (disabled) {
      return {
        bg: Colors.border,
        text: Colors.textTertiary,
        border: 'transparent',
      };
    }
    switch (variant) {
      case 'secondary':
        return { bg: Colors.input, text: Colors.text, border: Colors.border };
      case 'danger':
        return { bg: Colors.error, text: '#ffffff', border: 'transparent' };
      case 'outline':
        return { bg: Colors.card, text: Colors.primary, border: Colors.border };
      case 'ghost':
        return { bg: 'transparent', text: Colors.primary, border: 'transparent' };
      case 'google':
        return { bg: '#ffffff', text: Colors.text, border: Colors.border };
      case 'primary':
      default:
        return { bg: Colors.primary, text: '#ffffff', border: 'transparent' };
    }
  };

  const c = getColors();

  const sizeStyles: Record<ButtonSize, { py: number; px: number; fontSize: number }> = {
    sm: { py: 10, px: 16, fontSize: 13 },
    md: { py: 14, px: 22, fontSize: 15 },
    lg: { py: 16, px: 26, fontSize: 16 },
  };

  const s = sizeStyles[size];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: c.bg,
          borderColor: c.border,
          borderWidth: variant === 'outline' || variant === 'google' || variant === 'secondary' ? 1.2 : 0,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        variant === 'primary' && !isDisabled && styles.primaryShadow,
        variant === 'google' && !isDisabled && styles.googleShadow,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'google' ? Colors.primary : '#ffffff'}
          size="small"
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' ? <View style={styles.iconLeft}>{icon}</View> : null}
          <Text
            style={[
              styles.text,
              { color: c.text, fontSize: s.fontSize },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' ? <View style={styles.iconRight}>{icon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  iconLeft: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 10,
  },
  primaryShadow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  googleShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  disabled: {
    opacity: 0.55,
  },
});
