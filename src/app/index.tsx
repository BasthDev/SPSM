import { authService } from '@/services/authService';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Image, StyleSheet } from 'react-native';

/**
 * Index route — resolves auth state and redirects:
 *  - Logged in + profile complete → /dashboard
 *  - Logged in + no profile → /onboarding
 *  - Not logged in → /login
 */
export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    const resolve = async () => {
      // Tampilkan splash minimal 3 detik sebelum redirect
      const minDelay = new Promise((r) => setTimeout(r, 5000));
      try {
        const acct = await authService.getCurrentAccount();
        const profile = await authService.getUserProfile(acct.$id);

        if (profile) {
          await minDelay;
          router.replace('/dashboard');
        } else {
          await minDelay;
          router.replace('/onboarding');
        }
      } catch {
        await minDelay;
        router.replace('/login');
      }
    };

    resolve();
  }, [router]);

  return (
    <Image
      source={require('../assets/images/splash.png')}
      style={styles.splash}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
