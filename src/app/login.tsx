import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Button, GoogleIcon, LoadingScreen } from '@/components';
import { authService } from '@/services/authService';
import { Colors } from '@/theme/theme';
import { GraduationCap, ShieldCheck } from 'lucide-react-native';

WebBrowser.maybeCompleteAuthSession();

const SUCCESS_URL = 'appwrite-callback-6af1b3b200056ab6bc1d://auth/success';
const FAILURE_URL = 'appwrite-callback-6af1b3b200056ab6bc1d://auth/failure';

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const handledRef = useRef(false);

  const handleAuthCallback = useCallback(
    async (url: string) => {
      if (!url || handledRef.current) return;

      if (url.includes('/auth/success')) {
        handledRef.current = true;
        const { queryParams } = Linking.parse(url);
        const userId = queryParams?.userId as string | undefined;
        const secret = queryParams?.secret as string | undefined;

        if (userId && secret) {
          try {
            setLoading(true);
            await authService.createSession(userId, secret);

            // Check if profile exists
            const acct = await authService.getCurrentAccount();
            const profile = await authService.getUserProfile(acct.$id);

            if (profile) {
              router.replace('/dashboard');
            } else {
              router.replace('/onboarding');
            }
          } catch (e: any) {
            handledRef.current = false;
            Alert.alert('Error', 'Gagal membuat sesi. Silakan coba lagi.');
            console.error('Session creation failed', e);
          } finally {
            setLoading(false);
          }
        }
      } else if (url.includes('/auth/failure')) {
        Alert.alert('Login Gagal', 'Autentikasi Google dibatalkan atau gagal.');
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    let mounted = true;
    const checkExistingSession = async () => {
      try {
        const acct = await authService.getCurrentAccount();
        if (acct && mounted) {
          const profile = await authService.getUserProfile(acct.$id);
          if (profile) {
            router.replace('/dashboard');
            return;
          } else {
            router.replace('/onboarding');
            return;
          }
        }
      } catch {
        // Not logged in
      } finally {
        if (mounted) {
          setCheckingAuth(false);
        }
      }
    };

    checkExistingSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleAuthCallback(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleAuthCallback(url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleAuthCallback]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      handledRef.current = false;
      const loginUrl = authService.createGoogleToken(SUCCESS_URL, FAILURE_URL);
      const result = await WebBrowser.openAuthSessionAsync(loginUrl, SUCCESS_URL);

      if (result.type === 'success' && result.url) {
        await handleAuthCallback(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setLoading(false);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Gagal memulai proses login.');
      console.error('OAuth start failed', e);
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return <LoadingScreen message="Memeriksa sesi..." />;
  }

  return (
    <View style={styles.container}>
      {/* Background Decorative Circles */}
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />

      {/* Main Content Card */}
      <View style={styles.card}>
        {/* Brand Icon */}
        <View style={styles.iconCircle}>
          <GraduationCap size={36} color={Colors.primary} strokeWidth={2.2} />
        </View>

        {/* Brand Title */}
        <Text style={styles.appName}>SPSM</Text>
        <Text style={styles.appFullName}>Sarana Pengajuan Skripsi Mahasiswa</Text>

        <View style={styles.divider} />

        <Text style={styles.tagline}>
          Kelola pengajuan judul skripsi dan pantau alur penetapan Dosen Pembimbing secara transparan dan mudah.
        </Text>

        {/* Sign in Button */}
        <Button
          title="Sign in with Google"
          onPress={signInWithGoogle}
          variant="google"
          loading={loading}
          icon={<GoogleIcon size={20} />}
          style={styles.googleButton}
        />

        {/* Security / Institutional Note */}
        <View style={styles.securityRow}>
          <ShieldCheck size={14} color={Colors.textTertiary} strokeWidth={2} />
          <Text style={styles.footer}>
            Gunakan akun Google institusi untuk masuk
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#E0F2FE',
    opacity: 0.7,
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#F1F5F9',
    opacity: 0.8,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.card,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#0A4C8F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#BAE6FD',
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 2,
  },
  appFullName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    marginVertical: 18,
  },
  tagline: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  googleButton: {
    width: '100%',
    borderRadius: 16,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 6,
  },
  footer: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
