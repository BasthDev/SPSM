import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DepartmentItem, SystemSettings, ThesisSubmission, UserProfile } from '@/models/types';
import { academicService } from './academicService';
import { authService } from './authService';
import { settingsService } from './settingsService';
import { submissionService } from './submissionService';

export interface CachedUserData {
  profile: UserProfile;
  submissions: ThesisSubmission[];
  departments: DepartmentItem[];
  settings: SystemSettings;
  savedAt: number;
}

const keyFor = (userId: string) => `spsm_user_data_${userId}`;

export const userDataCache = {
  async get(userId: string): Promise<CachedUserData | null> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedUserData;
      if (!parsed?.profile || !Array.isArray(parsed.submissions)) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  async set(userId: string, data: Omit<CachedUserData, 'savedAt'>): Promise<void> {
    try {
      const payload: CachedUserData = { ...data, savedAt: Date.now() };
      await AsyncStorage.setItem(keyFor(userId), JSON.stringify(payload));
    } catch (e) {
      console.warn('Gagal menyimpan cache data user:', e);
    }
  },

  async clear(userId?: string): Promise<void> {
    try {
      if (userId) {
        await AsyncStorage.removeItem(keyFor(userId));
      } else {
        const keys = await AsyncStorage.getAllKeys();
        const ours = keys.filter((k) => k.startsWith('spsm_user_data_'));
        if (ours.length) await AsyncStorage.multiRemove(ours);
      }
    } catch {
      // ignore
    }
  },
};

/**
 * Fetch everything the dashboard needs for a user and persist it to local
 * cache so the next app open renders instantly. Intended to run in the
 * background right after login — never block navigation on this.
 */
export async function prefetchUserData(userId: string): Promise<void> {
  try {
    const [profile, submissions, departments, settings] = await Promise.all([
      authService.getUserProfile(userId),
      submissionService.getStudentSubmissionsWithDetails(userId),
      academicService.getDepartments(),
      settingsService.getSettings(),
    ]);
    if (!profile) return;
    await userDataCache.set(userId, {
      profile,
      submissions,
      departments: departments || [],
      settings,
    });
  } catch (e) {
    console.warn('Prefetch data user gagal:', e);
  }
}
