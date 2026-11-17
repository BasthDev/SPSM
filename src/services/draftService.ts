import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThesisSubmission } from '@/models/types';

export interface DraftTitleForm {
  title: string;
  background: string;
  journalTitle: string;
  journalAuthor: string;
  journalYear: string;
  relevanceVariable: string;
  relevanceMethodology: string;
  relevanceNote: string;
}

export interface SubmissionDraft {
  userId: string;
  titles: DraftTitleForm[];
  preferredAdvisor1: string;
  preferredAdvisor2: string;
  resubmitSource: string | null;
  step: number;
  savedAt: number;
  expiresAt: number;
}

// 1 bulan = 30 hari dalam milidetik
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const DRAFT_STORAGE_KEY_PREFIX = 'spsm_draft_submission_';

export const draftKeyFor = (userId: string) => `${DRAFT_STORAGE_KEY_PREFIX}${userId}`;

export const draftService = {
  /**
   * Menyimpan atau memperbarui data draf di AsyncStorage.
   * Setiap penyimpanan akan memperpanjang masa aktif selama 1 bulan (30 hari).
   */
  async saveDraft(
    userId: string,
    data: {
      titles: DraftTitleForm[];
      preferredAdvisor1?: string;
      preferredAdvisor2?: string;
      resubmitSource?: string | null;
      step?: number;
    }
  ): Promise<void> {
    try {
      if (!userId) return;

      // Cek apakah ada konten bermakna sebelum menyimpan
      const hasContent =
        data.titles.some(
          (t) =>
            t.title?.trim() ||
            t.background?.trim() ||
            t.journalTitle?.trim() ||
            t.relevanceVariable?.trim()
        ) ||
        Boolean(data.preferredAdvisor1) ||
        Boolean(data.preferredAdvisor2);

      if (!hasContent) {
        // Jika form kosong, jangan simpan draf baru
        return;
      }

      const now = Date.now();
      const draftPayload: SubmissionDraft = {
        userId,
        titles: data.titles,
        preferredAdvisor1: data.preferredAdvisor1 || '',
        preferredAdvisor2: data.preferredAdvisor2 || '',
        resubmitSource: data.resubmitSource || null,
        step: data.step ?? 0,
        savedAt: now,
        expiresAt: now + DRAFT_TTL_MS,
      };

      await AsyncStorage.setItem(draftKeyFor(userId), JSON.stringify(draftPayload));
    } catch (error) {
      console.warn('Gagal menyimpan draf pengajuan:', error);
    }
  },

  /**
   * Mengambil draf pengajuan user.
   * Jika draf sudah melebihi 1 bulan (kadaluarsa), otomatis dihapus dan return null.
   */
  async getDraft(userId: string): Promise<SubmissionDraft | null> {
    try {
      if (!userId) return null;
      const raw = await AsyncStorage.getItem(draftKeyFor(userId));
      if (!raw) return null;

      const draft: SubmissionDraft = JSON.parse(raw);

      // Validasi masa aktif 1 bulan
      if (Date.now() > draft.expiresAt) {
        // Kadaluarsa: bersihkan dari local storage
        await AsyncStorage.removeItem(draftKeyFor(userId));
        return null;
      }

      if (!Array.isArray(draft.titles)) {
        return null;
      }

      return draft;
    } catch (error) {
      console.warn('Gagal membaca draf pengajuan:', error);
      return null;
    }
  },

  /**
   * Menghapus draf dari local storage.
   */
  async clearDraft(userId: string): Promise<void> {
    try {
      if (!userId) return;
      await AsyncStorage.removeItem(draftKeyFor(userId));
    } catch (error) {
      console.warn('Gagal menghapus draf pengajuan:', error);
    }
  },

  /**
   * Mengonversi SubmissionDraft ke model ThesisSubmission agar dapat ditampilkan
   * secara native di antarmuka riwayat pengajuan dengan status 'drafting' (DRAF).
   */
  toThesisSubmission(draft: SubmissionDraft): ThesisSubmission {
    return {
      $id: 'draft',
      student_id: draft.userId,
      status: 'drafting',
      submitted_at: new Date(draft.savedAt).toISOString(),
      $createdAt: new Date(draft.savedAt).toISOString(),
      $updatedAt: new Date(draft.savedAt).toISOString(),
      preferred_advisor_1_id: draft.preferredAdvisor1 || null,
      preferred_advisor_2_id: draft.preferredAdvisor2 || null,
      options: draft.titles.map((t, idx) => ({
        $id: `draft-opt-${idx + 1}`,
        submission_id: 'draft',
        option_number: idx + 1,
        title: t.title?.trim() || `(Draf Opsi #${idx + 1} Belum Diisi)`,
        background: t.background?.trim() || '',
        journal_title: t.journalTitle?.trim() || '',
        journal_author: t.journalAuthor?.trim() || '',
        journal_year: t.journalYear?.trim() || '',
        relevance_variable: t.relevanceVariable?.trim() || '',
        relevance_methodology: t.relevanceMethodology?.trim() || '',
        relevance_note: t.relevanceNote?.trim() || '',
      })),
      logs: [],
    };
  },
};
