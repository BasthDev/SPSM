import { apiClient } from './apiClient';
import { mapDepartment, mapBatchYear } from '../lib/mappers';
import type { Department, BatchYear } from '../types';

export const masterDataService = {
  // Departments
  async getDepartments(): Promise<Department[]> {
    try {
      const list = await apiClient.departments.list();
      return (list || [])
        .map(mapDepartment)
        .filter((d) => d.code !== 'SETTINGS_SYS');
    } catch (err) {
      console.error('Error fetching departments:', err);
      return [];
    }
  },

  async createDepartment(data: Omit<Department, '$id'>): Promise<Department> {
    const res = await apiClient.departments.create(toPayload(data));
    return mapDepartment(res);
  },

  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    const res = await apiClient.departments.update(id, toPayload(data));
    return mapDepartment(res);
  },

  async deleteDepartment(id: string): Promise<boolean> {
    await apiClient.departments.remove(id);
    return true;
  },

  // Batch Years (Letting)
  async getBatchYears(): Promise<BatchYear[]> {
    try {
      const list = await apiClient.batchYears.list();
      return (list || [])
        .map(mapBatchYear)
        .sort((a, b) => Number(b.year) - Number(a.year));
    } catch (err) {
      console.error('Error fetching batch years:', err);
      return [];
    }
  },

  async createBatchYear(data: Omit<BatchYear, '$id'>): Promise<BatchYear> {
    const res = await apiClient.batchYears.create(toPayload(data));
    return mapBatchYear(res);
  },

  async updateBatchYear(id: string, data: Partial<BatchYear>): Promise<BatchYear> {
    const res = await apiClient.batchYears.update(id, toPayload(data));
    return mapBatchYear(res);
  },

  async deleteBatchYear(id: string): Promise<boolean> {
    await apiClient.batchYears.remove(id);
    return true;
  },
};

function toPayload(d: any): any {
  const out = { ...d };
  if (out.is_active !== undefined) { out.isActive = out.is_active; delete out.is_active; }
  delete out.$id; delete out.$createdAt; delete out.$updatedAt;
  return out;
}
