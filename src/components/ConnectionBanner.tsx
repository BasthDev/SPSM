import { onConnectionStatusChange } from '@/services/apiClient';
import { WifiOff, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ConnectionBanner() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = onConnectionStatusChange((err) => {
      setErrorMessage(err);
    });
    return unsubscribe;
  }, []);

  if (!errorMessage) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, { top: Math.max(insets.top, 12) }]}
    >
      <View style={styles.banner}>
        <View style={styles.iconWrapper}>
          <WifiOff size={18} color="#FFFFFF" strokeWidth={2.4} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.title}>Tidak dapat terhubung ke server</Text>
          <Text style={styles.subtitle}>Pastikan backend server aktif</Text>
        </View>
        <TouchableOpacity
          onPress={() => setErrorMessage(null)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeButton}
        >
          <X size={16} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  banner: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  iconWrapper: {
    marginRight: 10,
  },
  textWrapper: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
