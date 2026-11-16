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

        // Profil auto-dibuat kosong saat OAuth login — anggap "selesai onboarding"
        // hanya jika SEMUA field yang diisi form onboarding terisi.
        // phone & avatar sengaja tidak dicek: keduanya opsional di form,
        // kalau disertakan user yang mengosongkannya akan terjebak loop onboarding.
        // Role non-mahasiswa tidak pernah diarahkan ke onboarding.
        const staffRoles = ['admin', 'lecturer', 'kaprodi', 'akademik', 'reviewer', 'advisor'];
        const isStaff = staffRoles.includes((profile?.role || '').toLowerCase());
        const nim = profile?.nim_or_nip || profile?.nim || '';
        const isComplete = Boolean(
          profile?.name &&
            nim &&
            profile?.department &&
            Number(profile?.batch_year) > 0
        );

        if (profile && (isStaff || isComplete)) {
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
