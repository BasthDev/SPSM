import { apiClient, setAuthToken } from './apiClient';
import { mapLecturer, mapUserProfile } from '../lib/mappers';
import type { UserProfile, Lecturer, UserRole } from '../types';

export interface AuthState {
  account: any;
  profile: UserProfile | null;
  lecturer: Lecturer | null;
  role: UserRole;
  isAdmin: boolean;
  avatarUrl?: string | null;
}

const OAUTH_POPUP_NAME = 'spsm_oauth';
const OAUTH_POLL_MS = 2000;
const OAUTH_TIMEOUT_MS = 3 * 60 * 1000;

export const authService = {
  /**
   * Login with email & password (admin & staff terdaftar).
   */
  async loginWithEmail(email: string, pass: string) {
    try {
      const res = await apiClient.auth.login(email.trim(), pass);
      return res?.user ?? res;
    } catch (err: any) {
      throw new Error(err?.message || 'Gagal masuk dengan email & password.');
    }
  },

  /**
   * Google OAuth via backend (PocketBase). Membuka popup Google,
   * lalu polling /auth/oauth/status sampai selesai.
   */
  async loginWithGoogle(): Promise<any> {
    const { url, key } = await apiClient.request<any>('/auth/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ provider: 'google' }),
    });
    if (!url || !key) throw new Error('Gagal memulai login Google.');

    const popup = window.open(url, OAUTH_POPUP_NAME, 'width=520,height=680');
    if (!popup) throw new Error('Popup diblokir browser. Izinkan popup untuk login.');

    const deadline = Date.now() + OAUTH_TIMEOUT_MS;
    while (Date.now() < deadline) {
      // Popup boleh ditutup user setelah "Auth completed" — polling tetap
      // jalan sampai backend selesai exchange (sama seperti mobile).
      const status = await apiClient
        .request<any>(`/auth/oauth/status?key=${encodeURIComponent(key)}`)
        .catch(() => null);

      if (status?.status === 'done' && status?.token) {
        try {
          popup.close();
        } catch {}
        localStorage.setItem('spsm_token', status.token);
        return status.user;
      }
      if (status?.status === 'error') {
        try {
          popup.close();
        } catch {}
        throw new Error(status.error || 'Login Google gagal.');
      }
      if (status?.status === 'expired') {
        try {
          popup.close();
        } catch {}
        throw new Error(status.error || 'Sesi login kedaluwarsa. Coba lagi.');
      }

      await new Promise((r) => setTimeout(r, OAUTH_POLL_MS));
    }

    try {
      popup.close();
    } catch {}
    throw new Error(
      popup.closed ? 'Login dibatalkan.' : 'Waktu login habis. Coba lagi.'
    );
  },

  /**
   * Get the current authenticated user (profile, lecturer, role, isAdmin)
   * dari backend /auth/me.
   */
  async getCurrentUser(): Promise<AuthState | null> {
    try {
      const me = await apiClient.auth.getCurrentUser();
      if (!me) return null;

      const profile: UserProfile | null = me.profile ? mapUserProfile(me.profile) : null;
      const lecturer: Lecturer | null = me.lecturer ? mapLecturer(me.lecturer) : null;
      const role: UserRole = (me.role as UserRole) || profile?.role || 'student';
      const isAdmin = Boolean(me.isAdmin) || role === 'admin';

      return {
        account: {
          $id: me.userId || me.id,
          email: me.email,
          name: me.name,
        },
        profile,
        lecturer,
        role: isAdmin ? 'admin' : role,
        isAdmin,
        avatarUrl: profile?.avatar_url || lecturer?.email
          ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(me.name || me.email)}`
          : null,
      };
    } catch {
      return null;
    }
  },

  /**
   * Sign out current session.
   */
  async logout() {
    try {
      const { disconnectRealtime } = await import('./realtimeService');
      disconnectRealtime();
    } catch {}
    try {
      await apiClient.auth.logout();
    } catch (e: any) {
      console.warn('Logout warning:', e?.message);
    }
    setAuthToken(null);
  },
};
