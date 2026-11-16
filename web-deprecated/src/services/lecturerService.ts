import { apiClient } from './apiClient';
import { mapLecturer } from '../lib/mappers';
import type { Lecturer } from '../types';

export const lecturerService = {
  async getLecturers(role?: string): Promise<Lecturer[]> {
    try {
      const list = await apiClient.lecturers.list({});
      const mapped = (list || []).map(mapLecturer);
      return role ? mapped.filter((l) => l.role === role) : mapped;
    } catch (err) {
      console.error('Error fetching lecturers:', err);
      return [];
    }
  },

  async getLecturerById(id: string): Promise<Lecturer | null> {
    try {
      const res = await apiClient.lecturers.getById(id);
      return res ? mapLecturer(res) : null;
    } catch (err) {
      console.error('Error getting lecturer:', err);
      return null;
    }
  },

  async getLecturerByUserId(userId: string): Promise<Lecturer | null> {
    try {
      const list = await apiClient.lecturers.list({});
      const found = (list || []).find((l: any) => (l.user_id ?? l.userId) === userId);
      return found ? mapLecturer(found) : null;
    } catch (err) {
      console.error('Error getting lecturer by user_id:', err);
      return null;
    }
  },

  async getLecturerByEmail(email: string): Promise<Lecturer | null> {
    try {
      const list = await apiClient.lecturers.list({});
      const found = (list || []).find(
        (l: any) => (l.email || '').toLowerCase() === email.toLowerCase()
      );
      return found ? mapLecturer(found) : null;
    } catch (err) {
      console.error('Error getting lecturer by email:', err);
      return null;
    }
  },

  async createLecturer(data: Partial<Lecturer>): Promise<Lecturer> {
    const res = await apiClient.lecturers.create(toPayload(data));
    return mapLecturer(res);
  },

  async updateLecturer(id: string, data: Partial<Lecturer>): Promise<Lecturer> {
    const res = await apiClient.lecturers.update(id, toPayload(data));
    // Sync role ke users collection ditangani backend bila perlu;
    // di sini cukup update record dosen.
    return mapLecturer(res);
  },

  async deleteLecturer(id: string): Promise<boolean> {
    await apiClient.lecturers.remove(id);
    return true;
  },

  /**
   * Recalculates and synchronizes the active quota (current_students)
   * for a lecturer based on actually approved thesis submissions.
   * Matches both Pembimbing 1 and Pembimbing 2.
   */
  async syncStudentCount(advisorId: string): Promise<number> {
    if (!advisorId) return 0;
    try {
      const subs = await apiClient.submissions.list({ status: 'approved' });
      const count = (subs || []).filter((doc: any) => {
        const adv1 = doc.advisor1Id ?? doc.advisor1_id;
        const adv2 = doc.advisor2Id ?? doc.advisor2_id;
        return adv1 === advisorId || adv2 === advisorId;
      }).length;

      await apiClient.lecturers.update(advisorId, { currentStudents: count });
      return count;
    } catch (err) {
      console.error('Failed to sync student count:', err);
      return 0;
    }
  },

  async incrementStudentCount(id: string): Promise<void> {
    await this.syncStudentCount(id);
  },
};

function toPayload(d: Partial<Lecturer>): any {
  const out: any = { ...d };
  if (out.user_id !== undefined) { out.userId = out.user_id; delete out.user_id; }
  if (out.department_id !== undefined) { out.departmentId = out.department_id; delete out.department_id; }
  if (out.is_active !== undefined) { out.isActive = out.is_active; delete out.is_active; }
  if (out.current_students !== undefined) { out.currentStudents = out.current_students; delete out.current_students; }
  delete out.$id; delete out.$createdAt; delete out.$updatedAt;
  return out;
}
