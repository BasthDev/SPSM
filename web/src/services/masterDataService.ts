import { databases, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import type { Department, BatchYear } from '../types';

export const masterDataService = {
  // Departments
  async getDepartments(): Promise<Department[]> {
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.departments,
        [Query.orderAsc('name'), Query.limit(100)]
      );
      return res.documents as unknown as Department[];
    } catch (err) {
      console.error('Error fetching departments:', err);
      return [];
    }
  },

  async createDepartment(data: Omit<Department, '$id'>): Promise<Department> {
    const res = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.departments,
      ID.unique(),
      data
    );
    return res as unknown as Department;
  },

  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    const res = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.departments,
      id,
      data
    );
    return res as unknown as Department;
  },

  async deleteDepartment(id: string): Promise<boolean> {
    await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.departments,
      id
    );
    return true;
  },

  // Batch Years (Letting)
  async getBatchYears(): Promise<BatchYear[]> {
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.batchYears,
        [Query.orderDesc('year'), Query.limit(100)]
      );
      return res.documents as unknown as BatchYear[];
    } catch (err) {
      console.error('Error fetching batch years:', err);
      return [];
    }
  },

  async createBatchYear(data: Omit<BatchYear, '$id'>): Promise<BatchYear> {
    const res = await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.batchYears,
      ID.unique(),
      data
    );
    return res as unknown as BatchYear;
  },

  async updateBatchYear(id: string, data: Partial<BatchYear>): Promise<BatchYear> {
    const res = await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.batchYears,
      id,
      data
    );
    return res as unknown as BatchYear;
  },

  async deleteBatchYear(id: string): Promise<boolean> {
    await databases.deleteDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.batchYears,
      id
    );
    return true;
  },
};
