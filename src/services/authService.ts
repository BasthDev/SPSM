import { ID, Query, OAuthProvider } from 'appwrite';
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
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_USERS,
        [Query.equal('user_id', userId)]
      );
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
      const doc = await databases.createDocument(
        DATABASE_ID,
        COLLECTION_USERS,
        ID.unique(),
        {
          user_id: userId,
          name: data.name,
          email: data.email,
          role: 'student',
          nim_or_nip: data.nim,
          department: data.department,
          batch_year: parseInt(data.batchYear, 10),
          avatar_url: data.avatarUrl || null,
          created_at: new Date().toISOString(),
        }
      );
      return doc as unknown as UserProfile;
    } catch (error: any) {
      throw new Error(`Gagal menyimpan data onboarding: ${error.message}`);
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
