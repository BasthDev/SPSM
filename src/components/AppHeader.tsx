import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/theme/theme';

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  backHref?: string;
  rightAction?: React.ReactNode;
  onRightAction?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  backHref,
  rightAction,
  onRightAction,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else if (backHref) {
      router.replace(backHref as any);
    } else {
      router.back();
    }
  };

  const hasBack = showBack || !!backHref;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 10,
        },
      ]}
    >
      <StatusBar style="dark" />

      <View style={styles.content}>
        {hasBack ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2.4} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholderButton} />
        )}

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {rightAction ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onRightAction}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            disabled={!onRightAction}
          >
            {rightAction}
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholderButton} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.input,
  },
  placeholderButton: {
    width: 38,
    height: 38,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
