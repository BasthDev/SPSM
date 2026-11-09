import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { LoadingScreen } from '@/components';
import { authService } from '@/services/authService';

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
      try {
        const acct = await authService.getCurrentAccount();
        const profile = await authService.getUserProfile(acct.$id);

        if (profile) {
          router.replace('/dashboard');
        } else {
          router.replace('/onboarding');
        }
      } catch {
        router.replace('/login');
      }
    };

    resolve();
  }, [router]);

  return <LoadingScreen message="Memuat SPSM..." />;
}
