import { apiClient } from './apiClient';
import {
  type DepartmentItem,
  type BatchYearItem,
  type LecturerItem,
} from '@/models/types';

export const academicService = {
  /**
   * Fetch active departments from Universal API
   */
  async getDepartments(): Promise<DepartmentItem[]> {
    try {
      const depts = await apiClient.departments.list();
      return depts
        .filter((d: any) => d.isActive !== false && d.code !== 'SETTINGS_SYS')
        .map((d: any) => ({
          $id: d.id,
          name: d.name,
          code: d.code,
          faculty: d.faculty,
          is_active: d.isActive,
        })) as unknown as DepartmentItem[];
    } catch (e: any) {
      console.warn('Failed to fetch departments from API:', e.message);
      return [];
    }
  },

  /**
   * Fetch active batch years from Universal API
   */
  async getBatchYears(): Promise<BatchYearItem[]> {
    try {
      const years = await apiClient.batchYears.list();
      return years
        .filter((y: any) => y.isActive !== false)
        .map((y: any) => ({
          $id: y.id,
          year: Number(y.year),
          label: y.label || `Angkatan ${y.year}`,
          is_active: y.isActive,
        })) as unknown as BatchYearItem[];
    } catch (e: any) {
      console.warn('Failed to fetch batch years from API:', e.message);
      return [];
    }
  },

  /**
   * Fetch active lecturers for a specific department or all
   */
  async getLecturers(department?: string): Promise<LecturerItem[]> {
    try {
      const lecturers = await apiClient.lecturers.list({
        activeOnly: true,
        department,
      });
      return lecturers.map((lec: any) => ({
        $id: lec.id,
        id: lec.id,
        user_id: lec.userId,
        userId: lec.userId,
        name: lec.name,
        nip: lec.nip,
        email: lec.email,
        phone: lec.phone,
        department: lec.departmentId || lec.department,
        department_id: lec.departmentId || lec.department,
        departmentId: lec.departmentId || lec.department,
        expertise: lec.expertise,
        quota: lec.quota,
        current_students: lec.currentStudents,
        currentStudents: lec.currentStudents,
        role: lec.role,
        is_active: lec.isActive,
        isActive: lec.isActive,
      })) as unknown as LecturerItem[];
    } catch (e: any) {
      console.warn('Failed to fetch lecturers from API:', e.message);
      return [];
    }
  },
};
