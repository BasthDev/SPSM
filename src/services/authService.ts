import { ID, Query, OAuthProvider } from 'react-native-appwrite';
import {
  account,
  databases,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
} from './appwrite';
import {
  DATABASE_ID,
  COLLECTION_USERS,
  type UserProfile,
  type OnboardingFormData,
} from '@/models/types';

export const authService = {
  /**
   * Generates the Google OAuth2 token URL for Appwrite.
   * Constructed directly to avoid the Web JS SDK's attempt to assign
   * `window.location.href` in a React Native / Hermes environment.
   */
  createGoogleToken(successUrl: string, failureUrl: string): string {
    const base = `${APPWRITE_ENDPOINT}/account/tokens/oauth2/${OAuthProvider.Google}`;
    const params = new URLSearchParams({
      project: APPWRITE_PROJECT_ID,
      success: successUrl,
      failure: failureUrl,
    });
    return `${base}?${params.toString()}`;
  },

  /**
   * Exchange the OAuth token for a session after redirect.
   */
  async createSession(userId: string, secret: string) {
    try {
      return await account.createSession(userId, secret);
    } catch (error: any) {
      throw new Error(`Gagal membuat sesi: ${error.message}`);
    }
  },

  /**
   * Get the currently logged‑in Appwrite user account.
   * Throws if no active session.
   */
  async getCurrentAccount() {
    return await account.get();
  },

  /**
   * Check if a user profile document exists in the `users` collection.
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const response = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_USERS,
        queries: [Query.equal('user_id', userId)],
      });
      return response.documents.length > 0
        ? (response.documents[0] as unknown as UserProfile)
        : null;
    } catch (error: any) {
      throw new Error(`Gagal mengambil profil: ${error.message}`);
    }
  },

  /**
   * Save onboarding data for a new student.
   */
  async completeOnboarding(
    userId: string,
    data: OnboardingFormData
  ): Promise<UserProfile> {
    try {
      const doc = await databases.createDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_USERS,
        documentId: ID.unique(),
        data: {
          user_id: userId,
          name: data.name,
          email: data.email,
          role: 'student',
          nim_or_nip: data.nim,
          department: data.department,
          batch_year: parseInt(data.batchYear, 10),
          avatar_url: data.avatarUrl || null,
          created_at: new Date().toISOString(),
        },
      });
      return doc as unknown as UserProfile;
    } catch (error: any) {
      throw new Error(`Gagal menyimpan data onboarding: ${error.message}`);
    }
  },

  /**
   * Fetch Google profile avatar URL or fallback to initials.
   */
  async fetchGoogleAvatar(accountName?: string): Promise<string> {
    try {
      const session = await account.getSession('current');
      if (session && session.providerAccessToken) {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${session.providerAccessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.picture) return data.picture;
        }
      }
    } catch {
      // fallback
    }
    return `https://sgp.cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(
      accountName || 'User'
    )}&project=${APPWRITE_PROJECT_ID}`;
  },

  /**
   * Update avatar URL in the user's profile document.
   */
  async updateAvatarUrl(docId: string, avatarUrl: string): Promise<void> {
    try {
      await databases.updateDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_USERS,
        documentId: docId,
        data: {
          avatar_url: avatarUrl,
        },
      });
    } catch (e: any) {
      console.warn('Gagal memperbarui avatar:', e.message);
    }
  },

  /**
   * Tandai mahasiswa sudah upload file skripsi (untuk fitur selanjutnya).
   */
  async markThesisUploaded(userId: string): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);
      if (profile?.$id) {
        await databases.updateDocument({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_USERS,
          documentId: profile.$id,
          data: { has_uploaded_thesis: true },
        });
      }
    } catch (e: any) {
      console.warn('Gagal menandai upload skripsi:', e.message);
    }
  },

  /**
   * Sign out the current session.
   */
  async logout() {
    try {
      await account.deleteSession('current');
    } catch (error: any) {
      // Silently ignore if session already expired
      console.warn('Logout warning:', error.message);
    }
  },
};
