import { GoogleLoginButton, LoadingScreen } from '@/components';
import { apiClient } from '@/services/apiClient';
import { authService } from '@/services/authService';
import { prefetchUserData } from '@/services/userDataCache';
import { Colors, Shadows } from '@/theme/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Tutup Custom Tab/SFSafariViewController yang dibuka untuk OAuth. */
const closeAuthBrowser = () => {
  try {
    WebBrowser.dismissBrowser();
  } catch {
    // Browser sudah tertutup / tidak didukung platform
  }
};

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const cancelledRef = useRef(false);

  /** Setelah token tersimpan: cek profil → dashboard atau onboarding. */
  const finishLogin = async () => {
    const acct = await authService.getCurrentAccount();
    const profile = await authService.getUserProfile(acct.$id);

    if (profile) {
      if (!profile.avatar_url) {
        try {
          const avatar = await authService.fetchGoogleAvatar(acct.name);
          await authService.updateAvatarUrl(profile.$id, avatar);
        } catch {
          // ignore
        }
      }
      void prefetchUserData(acct.$id);
      router.replace('/dashboard');
    } else {
      router.replace('/onboarding');
    }
  };

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

  const cancelSignIn = () => {
    cancelledRef.current = true;
    closeAuthBrowser();
  };

  const signInWithGoogle = async () => {
    if (loading) return;
    cancelledRef.current = false;
    try {
      setLoading(true);

      // 1. Minta backend URL OAuth PocketBase + polling key
      const { url, key } = await apiClient.auth.oauthStart('google');
      if (cancelledRef.current) return;

      // 2. Buka halaman Google di browser (Custom Tab / SFSafariViewController)
      void WebBrowser.openBrowserAsync(url);

      // 3. Polling status sampai user selesai login / timeout 3 menit
      const deadline = Date.now() + 3 * 60 * 1000;
      while (Date.now() < deadline) {
        if (cancelledRef.current) return;
        await sleep(2500);
        if (cancelledRef.current) return;
        const st = await apiClient.auth.oauthStatus(key);
        if (st.status === 'done' && st.token) {
          closeAuthBrowser();
          await apiClient.auth.completeOAuthToken(st.token);
          await finishLogin();
          return;
        }
        if (st.status === 'error' || st.status === 'expired') {
          closeAuthBrowser();
          Alert.alert('Login Gagal', st.error || 'Autentikasi Google gagal.');
          return;
        }
      }
      if (!cancelledRef.current) {
        closeAuthBrowser();
        Alert.alert('Login Gagal', 'Waktu login habis. Silakan coba lagi.');
      }
    } catch (e: any) {
      if (cancelledRef.current) return;
      closeAuthBrowser();
      Alert.alert('Error', e?.message || 'Gagal memulai proses login.');
      console.error('OAuth start failed', e);
    } finally {
      cancelledRef.current = false;
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return <LoadingScreen message="Memeriksa sesi..." />;
  }

  return (
    <View style={styles.container}>
      {/* Hero section */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.logoBadge}>
          <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.appName}>SPSM</Text>
        <Text style={styles.appSubtitle}>Sarana Pengajuan Skripsi Mahasiswa</Text>
        {/* <Text style={styles.univName}>Universitas Muhammadiyah Aceh</Text> */}
      </LinearGradient>

      {/* Form card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Selamat Datang</Text>
        <Text style={styles.cardSubtitle}>
          Masuk dengan akun Google institusi untuk mengakses dashboard pengajuan skripsi Anda.
        </Text>

        <GoogleLoginButton loading={loading} onPress={signInWithGoogle} />

        {/* Slot batal selalu ada (fixed height) supaya layout tidak bergeser saat loading */}
        <View style={styles.cancelSlot}>
          {loading && (
            <TouchableOpacity onPress={cancelSignIn} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Batal</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.securityRow}>
          <ShieldCheck size={14} color={Colors.textTertiary} strokeWidth={2} />
          <Text style={styles.footer}>Data Anda aman dan terenkripsi</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  hero: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Shadows.lg,
  },
  logo: {
    width: 64,
    height: 64,
  },
  appName: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  univName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    marginTop: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    marginTop: -60,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
    ...Shadows.md,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  cancelSlot: {
    height: 36,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  footer: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
