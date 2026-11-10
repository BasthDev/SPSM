import { databases } from './appwrite';
import { Query } from 'react-native-appwrite';
import { DATABASE_ID, COLLECTION_DEPARTMENTS } from '@/models/types';

export interface SystemSettings {
  is_active: boolean;
  start_date: string;
  end_date: string;
  academic_year: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  is_active: true,
  start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  academic_year: '2025/2026 Ganjil',
};

const SETTINGS_DOC_CODE = 'SETTINGS_SYS';

export const settingsService = {
  /**
   * Fetch system settings. First tries `system_settings` collection.
   * If not found, falls back to the special document in `departments`.
   */
  async getSettings(): Promise<SystemSettings> {
    // 1. Try dedicated system_settings collection if exists
    try {
      const res = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: 'system_settings',
        queries: [Query.limit(1)],
      });
      if (res.documents.length > 0) {
        const doc = res.documents[0] as any;
        return {
          is_active: Boolean(doc.is_active),
          start_date: doc.start_date || DEFAULT_SETTINGS.start_date,
          end_date: doc.end_date || DEFAULT_SETTINGS.end_date,
          academic_year: doc.academic_year || DEFAULT_SETTINGS.academic_year,
        };
      }
    } catch {
      // ignore
    }

    // 2. Fallback to departments collection document
    try {
      const res = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_DEPARTMENTS,
        queries: [Query.equal('code', SETTINGS_DOC_CODE), Query.limit(1)],
      });

      if (res.documents.length > 0) {
        const rawJson = res.documents[0].name;
        const parsed = JSON.parse(rawJson);
        return {
          is_active: Boolean(parsed.is_active),
          start_date: parsed.start_date || DEFAULT_SETTINGS.start_date,
          end_date: parsed.end_date || DEFAULT_SETTINGS.end_date,
          academic_year: parsed.academic_year || DEFAULT_SETTINGS.academic_year,
        };
      }

      return DEFAULT_SETTINGS;
    } catch (err) {
      console.warn('Failed to load system settings from database, using defaults:', err);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * Checks whether the submission period is open according to settings.
   */
  isPeriodOpen(settings: SystemSettings): { isOpen: boolean; reason?: string } {
    if (!settings.is_active) {
      return {
        isOpen: false,
        reason: 'Masa pengajuan judul skripsi saat ini sedang ditutup oleh Administrator.',
      };
    }

    const now = new Date().getTime();
    const start = new Date(settings.start_date).getTime();
    const end = new Date(settings.end_date).getTime();

    if (!isNaN(start) && now < start) {
      const startStr = new Date(settings.start_date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return {
        isOpen: false,
        reason: `Masa pengajuan belum dibuka. Jadwal mulai: ${startStr}.`,
      };
    }

    if (!isNaN(end) && now > end) {
      const endStr = new Date(settings.end_date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return {
        isOpen: false,
        reason: `Masa pengajuan telah berakhir pada tanggal ${endStr}.`,
      };
    }

    return { isOpen: true };
  },
};
