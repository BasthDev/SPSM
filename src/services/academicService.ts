import { databases } from './appwrite';
import { Query, ID } from 'appwrite';
import {
  DATABASE_ID,
  COLLECTION_DEPARTMENTS,
  COLLECTION_BATCH_YEARS,
  COLLECTION_LECTURERS,
  type DepartmentItem,
  type BatchYearItem,
  type LecturerItem,
} from '@/models/types';

export const academicService = {
  /**
   * Fetch active departments from Appwrite database
   */
  async getDepartments(): Promise<DepartmentItem[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_DEPARTMENTS,
        [Query.equal('is_active', true), Query.limit(50)]
      );
      return response.documents as unknown as DepartmentItem[];
    } catch (e: any) {
      console.warn('Failed to fetch departments from db, using fallback:', e.message);
      return [];
    }
  },

  /**
   * Fetch active batch years (letting) from Appwrite database
   */
  async getBatchYears(): Promise<BatchYearItem[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_BATCH_YEARS,
        [Query.equal('is_active', true), Query.orderDesc('year'), Query.limit(50)]
      );
      return response.documents as unknown as BatchYearItem[];
    } catch (e: any) {
      console.warn('Failed to fetch batch years from db, using fallback:', e.message);
      return [];
    }
  },

  /**
   * Fetch active lecturers for a specific department or all
   */
  async getLecturers(departmentId?: string): Promise<LecturerItem[]> {
    try {
      const queries = [Query.equal('is_active', true), Query.limit(100)];
      if (departmentId) {
        queries.push(Query.equal('department_id', departmentId));
      }
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_LECTURERS,
        queries
      );
      return response.documents as unknown as LecturerItem[];
    } catch (e: any) {
      console.error('Failed to fetch lecturers:', e.message);
      return [];
    }
  },

  /**
   * Create or update department (Admin)
   */
  async createDepartment(data: { name: string; code: string; faculty?: string }) {
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTION_DEPARTMENTS,
      ID.unique(),
      { ...data, is_active: true }
    );
  },

  /**
   * Create or update batch year / letting (Admin)
   */
  async createBatchYear(data: { year: number; label: string }) {
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTION_BATCH_YEARS,
      ID.unique(),
      { ...data, is_active: true }
    );
  },

  /**
   * Create lecturer (Admin)
   */
  async createLecturer(data: Omit<LecturerItem, '$id'>) {
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTION_LECTURERS,
      ID.unique(),
      data
    );
  },
};
