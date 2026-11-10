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

  async getLecturerByUserId(userId: string): Promise<Lecturer | null> {
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.lecturers,
        [Query.equal('user_id', userId), Query.limit(1)]
      );
      return res.documents.length > 0 ? (res.documents[0] as unknown as Lecturer) : null;
    } catch (err) {
      console.error('Error getting lecturer by user_id:', err);
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

    // If role changed and user_id or email exists, sync role to users collection
    if (data.role && (res.user_id || res.email)) {
      try {
        const userQueries = res.user_id
          ? [Query.equal('user_id', res.user_id)]
          : [Query.equal('email', res.email)];
        const userDocs = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          userQueries
        );
        for (const u of userDocs.documents) {
          await databases.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.users,
            u.$id,
            { role: data.role }
          );
        }
      } catch (err) {
        console.warn('Sync role to users collection warning:', err);
      }
    }

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

  /**
   * Recalculates and synchronizes the active quota (current_students)
   * for a lecturer based on actually approved thesis submissions.
   * Matches both Pembimbing 1 and Pembimbing 2.
   */
  async syncStudentCount(advisorId: string): Promise<number> {
    if (!advisorId) return 0;
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        [
          Query.equal('status', 'approved'),
          Query.limit(200),
        ]
      );
      // Count submissions where advisorId is in advisor_id (comma-separated or single)
      const count = res.documents.filter((doc: any) => {
        if (!doc.advisor_id) return false;
        const parts = String(doc.advisor_id).split(',').map((s: string) => s.trim());
        return parts.includes(advisorId);
      }).length;

      await databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.lecturers,
        advisorId,
        { current_students: count }
      );
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
