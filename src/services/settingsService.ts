import { apiClient } from './apiClient';
import {
  SystemSettings,
  UserProfile,
  AcademicRequirements,
} from '@/models/types';

export type { SystemSettings };

export const DEFAULT_SETTINGS: SystemSettings = {
  is_active: true,
  start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  academic_year: '2025/2026 Ganjil',
  min_sks: 100,
  required_title_count: 3,
  // No hardcoded courses — admin controls required_courses via system_settings
  required_courses: [],
};

export interface PeriodDisplayStatus {
  status: 'open' | 'upcoming' | 'closed';
  title: string;
  description: string;
  dateRangeText: string;
  academicYear: string;
  isOpen: boolean;
}

export interface EligibilityResult {
  isEligible: boolean;
  studentSks: number;
  minSks: number;
  sksSatisfied: boolean;
  requiredCourses: string[];
  completedCourses: string[];
  missingCourses: string[];
  coursesSatisfied: boolean;
  gpa?: number;
  reasons: string[];
}

export const settingsService = {
  /**
   * Fetch system settings directly from Appwrite `system_settings` collection.
   */
  async getSettings(): Promise<SystemSettings> {
    try {
      const data = await apiClient.settings.get();
      if (data) {
        return {
          is_active: data.isActive ?? data.submissionOpen ?? true,
          start_date: data.startDate || DEFAULT_SETTINGS.start_date,
          end_date: data.endDate || DEFAULT_SETTINGS.end_date,
          academic_year: data.academicYear || DEFAULT_SETTINGS.academic_year,
          min_sks: typeof data.minSks === 'number' ? data.minSks : DEFAULT_SETTINGS.min_sks,
          required_title_count:
            data.requiredTitleCount ?? data.maxOptions ?? DEFAULT_SETTINGS.required_title_count,
          required_courses: Array.isArray(data.requiredCourses)
            ? data.requiredCourses
            : [],
        };
      }
    } catch (err) {
      console.warn('Failed to load system settings from API, using defaults:', err);
    }

    return DEFAULT_SETTINGS;
  },

  /**
   * Returns rich display status for top info card: BUKA, AKAN DATANG, or TUTUP.
   */
  getPeriodDisplayStatus(settings: SystemSettings): PeriodDisplayStatus {
    const formatDate = (isoString: string) => {
      try {
        const d = new Date(isoString);
        return d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      } catch {
        return isoString;
      }
    };

    const startFormatted = formatDate(settings.start_date);
    const endFormatted = formatDate(settings.end_date);
    const dateRangeText = `${startFormatted} – ${endFormatted}`;
    const academicYear = settings.academic_year || '2025/2026 Ganjil';

    if (!settings.is_active) {
      return {
        status: 'closed',
        title: 'Masa Pengajuan Ditutup',
        description: 'Pendaftaran judul skripsi saat ini sedang ditutup sementara oleh Administrator.',
        dateRangeText,
        academicYear,
        isOpen: false,
      };
    }

    const now = Date.now();
    const start = new Date(settings.start_date).getTime();
    const end = new Date(settings.end_date).getTime();

    if (!isNaN(start) && now < start) {
      return {
        status: 'upcoming',
        title: 'Masa Pengajuan Akan Datang',
        description: `Pendaftaran judul skripsi belum dibuka. Pengajuan akan dimulai pada ${startFormatted}.`,
        dateRangeText,
        academicYear,
        isOpen: false,
      };
    }

    if (!isNaN(end) && now > end) {
      return {
        status: 'closed',
        title: 'Masa Pengajuan Telah Berakhir',
        description: `Batas akhir pendaftaran judul skripsi telah berakhir pada ${endFormatted}.`,
        dateRangeText,
        academicYear,
        isOpen: false,
      };
    }

    return {
      status: 'open',
      title: 'Masa Pengajuan Dibuka',
      description: `Pendaftaran judul skripsi aktif sampai ${endFormatted}. Silakan ajukan usulan judul Anda.`,
      dateRangeText,
      academicYear,
      isOpen: true,
    };
  },

  /**
   * Checks whether the submission period is open according to settings.
   */
  isPeriodOpen(settings: SystemSettings): { isOpen: boolean; reason?: string } {
    const display = this.getPeriodDisplayStatus(settings);
    return {
      isOpen: display.isOpen,
      reason: display.description,
    };
  },

  /**
   * Compares student requirements (SKS and completed courses in JSON)
   * against the system requirements (min_sks and required_courses).
   */
  evaluateStudentEligibility(
    settings: SystemSettings,
    profile?: UserProfile | null
  ): EligibilityResult {
    if (!profile) {
      return {
        isEligible: true,
        studentSks: 0,
        minSks: settings.min_sks,
        sksSatisfied: true,
        requiredCourses: settings.required_courses || [],
        completedCourses: [],
        missingCourses: [],
        coursesSatisfied: true,
        reasons: [],
      };
    }

    let parsedRequirements: AcademicRequirements | null = null;
    if (profile.academic_requirements) {
      try {
        parsedRequirements =
          typeof profile.academic_requirements === 'string'
            ? JSON.parse(profile.academic_requirements)
            : profile.academic_requirements;
      } catch {
        // ignore parse error
      }
    }

    // Student SKS strictly from academic_requirements JSON or current_sks
    const studentSks =
      typeof parsedRequirements?.sks === 'number'
        ? parsedRequirements.sks
        : typeof profile.current_sks === 'number' && profile.current_sks > 0
        ? profile.current_sks
        : 0;

    // Completed courses strictly extracted from user's academic_requirements JSON
    let completedCourses: string[] = [];
    if (parsedRequirements) {
      const rawList =
        parsedRequirements.completed_courses ||
        (parsedRequirements as any).courses ||
        (parsedRequirements as any).matkul ||
        (parsedRequirements as any).mata_kuliah ||
        [];

      if (Array.isArray(rawList)) {
        completedCourses = rawList
          .map((item: any) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
              // Exclude if explicitly failed
              if (item.passed === false || item.status === 'tidak_lulus' || item.grade === 'E') {
                return null;
              }
              return (item.name || item.course || item.matkul || item.title || '').trim();
            }
            return '';
          })
          .filter(Boolean) as string[];
      }
    }

    const requiredCourses: string[] = settings.required_courses || [];
    const minSks = typeof settings.min_sks === 'number' ? settings.min_sks : 100;

    const sksSatisfied = studentSks >= minSks;

    const completedNormalized = completedCourses.map((c) => c.trim().toLowerCase());
    const missingCourses = requiredCourses.filter(
      (req) => !completedNormalized.includes(req.trim().toLowerCase())
    );
    const coursesSatisfied = missingCourses.length === 0;

    const reasons: string[] = [];
    if (!sksSatisfied) {
      reasons.push(`Total SKS Anda (${studentSks} SKS) kurang dari syarat minimal ${minSks} SKS.`);
    }
    if (!coursesSatisfied) {
      reasons.push(`Belum menyelesaikan mata kuliah prasyarat: ${missingCourses.join(', ')}.`);
    }

    return {
      isEligible: sksSatisfied && coursesSatisfied,
      studentSks,
      minSks,
      sksSatisfied,
      requiredCourses,
      completedCourses,
      missingCourses,
      coursesSatisfied,
      gpa: parsedRequirements?.gpa,
      reasons,
    };
  },

  /**
   * Backward compatible check helper.
   */
  checkStudentEligibility(
    settings: SystemSettings,
    profile?: UserProfile | null
  ): { eligible: boolean; message?: string } {
    const evalResult = this.evaluateStudentEligibility(settings, profile);
    return {
      eligible: evalResult.isEligible,
      message: evalResult.reasons.join('\n'),
    };
  },
};
