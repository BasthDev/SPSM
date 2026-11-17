import { apiClient } from './apiClient';
import {
  type UserProfile,
  type OnboardingFormData,
} from '@/models/types';

export const authService = {
  /**
   * @deprecated Gunakan apiClient.auth.getGoogleOAuthUrl() untuk OAuth via backend PocketBase.
   * Method ini tidak lagi dipakai sejak migrasi dari Appwrite ke PocketBase.
   */
  createGoogleToken(_successUrl: string, _failureUrl: string): string {
    // Legacy Appwrite OAuth URL — tidak digunakan. OAuth kini via backend /auth/google.
    console.warn('createGoogleToken: deprecated, gunakan OAuth via backend');
    return '';
  },

  async createSession(userId: string, secret: string) {
    try {
      const res = await apiClient.auth.exchangeOAuthSession(userId, secret);
      return res;
    } catch (error: any) {
      throw new Error(`Gagal membuat sesi: ${error.message}`);
    }
  },

  async getCurrentAccount(): Promise<{ $id: string; email: string; name: string }> {
    const user = await apiClient.auth.getCurrentUser();
    if (!user) {
      throw new Error('Sesi tidak ditemukan atau belum login.');
    }
    return {
      $id: user.userId || user.id,
      email: user.email,
      name: user.name,
    };
  },

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const prof = await apiClient.users.getProfile(userId);
      if (!prof) return null;
      return {
        $id: prof.id,
        user_id: prof.userId,
        name: prof.name,
        email: prof.email,
        role: prof.role || 'student',
        nim_or_nip: prof.nimOrNip || prof.nim || '',
        nim: prof.nim || prof.nimOrNip || undefined,
        department: prof.department,
        batch_year: Number(prof.batchYear || 0),
        current_sks:
          typeof prof.currentSks === 'number' ? prof.currentSks : undefined,
        academic_requirements: prof.academicRequirements ?? undefined,
        avatar_url: prof.avatarUrl || null,
        phone: prof.phone || undefined,
        has_uploaded_thesis: Boolean(prof.hasUploadedThesis ?? prof.thesisUploaded),
        created_at: prof.createdAt || '',
      } as unknown as UserProfile;
    } catch (error: any) {
      console.warn(`Gagal mengambil profil: ${error.message}`);
      return null;
    }
  },

  async completeOnboarding(
    userId: string,
    data: OnboardingFormData
  ): Promise<UserProfile> {
    try {
      const updated = await apiClient.users.updateProfile(userId, {
        name: data.name,
        email: data.email,
        nim: data.nim,
        nimOrNip: data.nim,
        department: data.department,
        batchYear: parseInt(data.batchYear, 10),
        avatarUrl: data.avatarUrl || null,
        phone: data.phone,
      });
      return {
        $id: updated.id,
        user_id: updated.userId,
        name: updated.name,
        email: updated.email,
        role: updated.role || 'student',
        nim_or_nip: updated.nimOrNip || updated.nim || '',
        nim: updated.nim || updated.nimOrNip || undefined,
        department: updated.department,
        batch_year: Number(updated.batchYear || 0),
        current_sks:
          typeof updated.currentSks === 'number' ? updated.currentSks : undefined,
        academic_requirements: updated.academicRequirements ?? undefined,
        avatar_url: updated.avatarUrl || null,
        phone: updated.phone || undefined,
        has_uploaded_thesis: Boolean(
          updated.hasUploadedThesis ?? updated.thesisUploaded
        ),
        created_at: updated.createdAt || '',
      } as unknown as UserProfile;
    } catch (error: any) {
      throw new Error(`Gagal menyimpan data onboarding: ${error.message}`);
    }
  },

  /** Update field profil yang boleh diedit mahasiswa (nama, NIM, prodi, angkatan, telepon, avatar). */
  async updateProfile(
    userId: string,
    patch: {
      name?: string;
      nim?: string;
      department?: string;
      batchYear?: number | string;
      phone?: string;
      avatarUrl?: string | null;
    }
  ): Promise<UserProfile | null> {
    const payload: Record<string, any> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.nim !== undefined) {
      payload.nim = patch.nim;
      payload.nimOrNip = patch.nim;
    }
    if (patch.department !== undefined) payload.department = patch.department;
    if (patch.batchYear !== undefined) payload.batchYear = Number(patch.batchYear);
    if (patch.phone !== undefined) payload.phone = patch.phone;
    if (patch.avatarUrl !== undefined) payload.avatarUrl = patch.avatarUrl;

    await apiClient.users.updateProfile(userId, payload);
    return this.getUserProfile(userId);
  },

  /**
   * Generate initial avatar URL dari nama pengguna menggunakan API backend.
   * Tidak lagi menggunakan Appwrite avatar service.
   */
  async fetchGoogleAvatar(accountName?: string): Promise<string> {
    const name = encodeURIComponent(accountName || 'User');
    // Gunakan UI Avatars sebagai fallback publik (tidak perlu auth)
    return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=128`;
  },

  async updateAvatarUrl(docId: string, avatarUrl: string): Promise<void> {
    try {
      await apiClient.users.updateProfile(docId, { avatarUrl });
    } catch (e: any) {
      console.warn('Gagal memperbarui avatar:', e.message);
    }
  },

  async markThesisUploaded(userId: string): Promise<void> {
    try {
      await apiClient.users.updateProfile(userId, {
        thesisUploaded: true,
        hasUploadedThesis: true,
        has_uploaded_thesis: true,
      });
    } catch (e: any) {
      console.warn('Gagal menandai upload skripsi:', e.message);
    }
  },

  async logout() {
    try {
      await apiClient.auth.logout();
    } catch (error: any) {
      console.warn('Logout warning:', error.message);
    }
  },
};
