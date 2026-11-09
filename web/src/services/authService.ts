import { account, databases, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { OAuthProvider } from 'appwrite';
import type { UserProfile, Lecturer, UserRole } from '../types';

export interface AuthState {
  account: any;
  profile: UserProfile | null;
  lecturer: Lecturer | null;
  role: UserRole;
  isAdmin: boolean;
}

export const authService = {
  /**
   * Initiate Google OAuth2 login for Web.
   */
  loginWithGoogle() {
    const successUrl = window.location.origin + window.location.pathname;
    const failureUrl = window.location.origin + window.location.pathname + '?error=oauth_failed';

    account.createOAuth2Session(
      OAuthProvider.Google,
      successUrl,
      failureUrl
    );
  },

  /**
   * Login with email & password (used by Admin and registered staff).
   */
  async loginWithEmail(email: string, pass: string) {
    try {
      return await account.createEmailPasswordSession(email.trim(), pass);
    } catch (err: any) {
      throw new Error(err.message || 'Gagal masuk dengan email & password.');
    }
  },

  /**
   * Get the current authenticated user with auto-registration for lecturers.
   */
  async getCurrentUser(): Promise<AuthState | null> {
    try {
      const acct = await account.get();
      if (!acct || !acct.$id) return null;

      const isAdminEmail = acct.email.toLowerCase() === 'ws.basithachmed@gmail.com';

      // 1. Fetch UserProfile from 'users' collection
      let profile: UserProfile | null = null;
      try {
        const userRes = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          [Query.equal('user_id', acct.$id), Query.limit(1)]
        );
        if (userRes.documents.length > 0) {
          profile = userRes.documents[0] as unknown as UserProfile;
        }
      } catch (e) {
        console.warn('Error fetching user profile doc:', e);
      }

      // 2. Fetch Lecturer record from 'lecturers' collection
      let lecturer: Lecturer | null = null;
      try {
        const lecRes = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.lecturers,
          [Query.equal('email', acct.email), Query.limit(1)]
        );
        if (lecRes.documents.length > 0) {
          lecturer = lecRes.documents[0] as unknown as Lecturer;
          // Link user_id if not linked yet
          if (!lecturer.user_id) {
            await databases.updateDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.lecturers,
              lecturer.$id,
              { user_id: acct.$id }
            );
            lecturer.user_id = acct.$id;
          }
        }
      } catch (e) {
        console.warn('Error fetching lecturer doc:', e);
      }

      // 3. Handle Auto-Registration for new Google users or Missing Docs
      const defaultRole: UserRole = isAdminEmail ? 'admin' : (lecturer?.role || 'lecturer');

      if (!profile) {
        try {
          const newDoc = await databases.createDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.users,
            ID.unique(),
            {
              user_id: acct.$id,
              name: acct.name || (isAdminEmail ? 'Admin Utama SPSM' : 'Dosen'),
              email: acct.email,
              role: defaultRole,
              nim_or_nip: lecturer?.nip || ('DOSEN-' + acct.$id.substring(0, 6).toUpperCase()),
              department: lecturer?.department_id || 'TI',
              batch_year: 2026,
              avatar_url: null,
              created_at: new Date().toISOString(),
            }
          );
          profile = newDoc as unknown as UserProfile;
        } catch (e) {
          console.warn('Could not auto-create user profile doc:', e);
        }
      }

      if (!lecturer) {
        try {
          const newLec = await databases.createDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.lecturers,
            ID.unique(),
            {
              user_id: acct.$id,
              nip: profile?.nim_or_nip || ('DOSEN-' + acct.$id.substring(0, 6).toUpperCase()),
              name: acct.name || (isAdminEmail ? 'Admin Utama SPSM' : 'Dosen'),
              email: acct.email,
              department_id: profile?.department || 'TI',
              expertise: isAdminEmail ? 'Administrator Sistem' : 'Dosen Pembimbing Skripsi',
              quota: 10,
              current_students: 0,
              role: defaultRole,
              is_active: true,
            }
          );
          lecturer = newLec as unknown as Lecturer;
        } catch (e) {
          console.warn('Could not auto-create lecturer doc:', e);
        }
      }

      // Determine final active role
      let finalRole: UserRole = defaultRole;
      if (isAdminEmail) {
        finalRole = 'admin';
      } else if (lecturer?.role) {
        finalRole = lecturer.role as UserRole;
      } else if (profile?.role) {
        finalRole = profile.role;
      }

      return {
        account: acct,
        profile,
        lecturer,
        role: finalRole,
        isAdmin: finalRole === 'admin',
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
      await account.deleteSession('current');
    } catch (e: any) {
      console.warn('Logout warning:', e.message);
    }
  },
};
