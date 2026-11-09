import { databases, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import type { Lecturer } from '../types';

export const lecturerService = {
  async getLecturers(role?: string): Promise<Lecturer[]> {
    try {
      const queries = [Query.orderAsc('name'), Query.limit(100)];
      if (role) {
        queries.push(Query.equal('role', role));
      }
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.lecturers,
        queries
      );
      return res.documents as unknown as Lecturer[];
    } catch (err) {
      console.error('Error fetching lecturers:', err);
      return [];
    }
  },

  async getLecturerById(id: string): Promise<Lecturer | null> {
    try {
      const res = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.lecturers,
        id
      );
      return res as unknown as Lecturer;
    } catch (err) {
      console.error('Error getting lecturer:', err);
      return null;
    }
  },

  async createLecturer(data: Omit<Lecturer, '$id'>): Promise<Lecturer> {
    const res = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      ID.unique(),
      data
    );
    return res as unknown as Lecturer;
  },

  async updateLecturer(id: string, data: Partial<Lecturer>): Promise<Lecturer> {
    const res = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      id,
      data
    );
    return res as unknown as Lecturer;
  },

  async deleteLecturer(id: string): Promise<boolean> {
    await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.lecturers,
      id
    );
    return true;
  },

  async incrementStudentCount(id: string): Promise<void> {
    try {
      const lecturer = await this.getLecturerById(id);
      if (lecturer) {
        await this.updateLecturer(id, {
          current_students: (lecturer.current_students || 0) + 1,
        });
      }
    } catch (err) {
      console.error('Failed to increment student count:', err);
    }
  },
};
