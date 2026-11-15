import { apiClient } from './apiClient';
import { mapSettings } from '../lib/mappers';

export interface SystemSettings {
  is_active: boolean;
  start_date: string;
  end_date: string;
  academic_year: string;
  min_sks?: number;
  required_title_count?: number;
  required_courses?: string[];
}

const DEFAULT_SETTINGS: SystemSettings = {
  is_active: true,
  start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  academic_year: '2025/2026 Ganjil',
  min_sks: 100,
  required_title_count: 3,
  required_courses: [],
};

export const settingsService = {
  /**
   * Fetch system settings dari backend /settings.
   */
  async getSettings(): Promise<SystemSettings> {
    try {
      const res = await apiClient.settings.get();
      if (!res) return DEFAULT_SETTINGS;
      const mapped = mapSettings(res);
      return {
        ...DEFAULT_SETTINGS,
        ...mapped,
        min_sks: mapped.min_sks ?? DEFAULT_SETTINGS.min_sks,
        required_title_count: mapped.required_title_count ?? DEFAULT_SETTINGS.required_title_count,
        required_courses: mapped.required_courses ?? DEFAULT_SETTINGS.required_courses,
      };
    } catch (err) {
      console.warn('Failed to load system settings, using defaults:', err);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * Update system settings via PATCH /settings.
   */
  async updateSettings(settings: SystemSettings): Promise<SystemSettings> {
    const payload = {
      isActive: settings.is_active,
      submissionOpen: settings.is_active,
      startDate: settings.start_date,
      endDate: settings.end_date,
      academicYear: settings.academic_year,
      minSks: settings.min_sks,
      requiredTitleCount: settings.required_title_count,
      requiredCourses: settings.required_courses,
    };

    try {
      await apiClient.settings.update(payload);
    } catch (err: any) {
      console.error('Failed to update system settings:', err);
      throw new Error(`Gagal menyimpan pengaturan: ${err?.message || err}`);
    }

    return settings;
  },

  /**
   * Checks whether the submission period is open according to settings.
   */
  isPeriodOpen(settings: SystemSettings): { isOpen: boolean; reason?: string } {
    if (!settings.is_active) {
      return {
        isOpen: false,
        reason: 'Pengajuan sedang ditutup sementara oleh Administrator.',
      };
    }

    const now = new Date().getTime();
    const start = new Date(settings.start_date).getTime();
    const end = new Date(settings.end_date).getTime();

    if (!isNaN(start) && now < start) {
      const startStr = new Date(settings.start_date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
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
        month: 'short',
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
