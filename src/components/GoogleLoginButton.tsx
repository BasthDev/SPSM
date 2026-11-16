import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GoogleIcon } from './GoogleIcon';
import { Colors } from '@/theme/theme';

type GoogleLoginButtonProps = {
  loading?: boolean;
  onPress: () => void;
};

/**
 * Tombol login Google khusus halaman login.
 * Tinggi & layout selalu tetap — spinner loading tampil di tengah
 * tanpa menggeser posisi tombol.
 */
export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  loading = false,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.buttonDisabled]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
    >
      <View style={styles.content}>
        {loading ? (
          <>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Menghubungkan ke Google...</Text>
          </>
        ) : (
          <>
            <GoogleIcon size={20} />
            <Text style={styles.label}>Sign in with Google</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.85,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
