import { db } from '../database';
import {
  LecturerDto,
  DepartmentDto,
  BatchYearDto,
  SystemSettingsDto,
  SuratDto,
} from '../database/types';

export function extractProdiCode(dept?: string): string {
  if (!dept) return 'TI';
  const clean = dept.trim().toUpperCase();
  if (clean.includes('BISNIS DIGITAL') || clean.startsWith('BD')) return 'BD';
  if (clean.includes('INFORMATIKA') || clean.startsWith('TI')) return 'TI';
  if (clean.includes('SISTEM INFORMASI') || clean.startsWith('SI')) return 'SI';
  if (clean.includes('ELEKTRO') || clean.startsWith('TE')) return 'TE';
  if (clean.includes('MESIN') || clean.startsWith('TM')) return 'TM';
  if (clean.includes('SIPIL') || clean.startsWith('TS')) return 'TS';
  if (clean.includes('MANAJEMEN') || clean.startsWith('MN')) return 'MN';
  if (clean.includes('AKUNTANSI') || clean.startsWith('AK')) return 'AK';
  if (clean.length <= 4) return clean;
  return clean.split(' ').map((w) => w[0]).join('').slice(0, 4) || 'TI';
}

export function extractAngkatan(batchYear?: number | string): string {
  if (!batchYear) return '23';
  const str = String(batchYear).trim();
  return str.length >= 2 ? str.slice(-2) : str.padStart(2, '0');
}

export class MasterDataService {
  // Lecturers
  async listLecturers(filter?: { activeOnly?: boolean; department?: string }): Promise<LecturerDto[]> {
    return db.listLecturers(filter);
  }

  async getLecturerById(id: string): Promise<LecturerDto | null> {
    return db.getLecturerById(id);
  }

  async createLecturer(data: Omit<LecturerDto, 'id'>): Promise<LecturerDto> {
    return db.createLecturer(data);
  }

  async updateLecturer(id: string, patch: Partial<LecturerDto>): Promise<LecturerDto> {
    return db.updateLecturer(id, patch);
  }

  async deleteLecturer(id: string): Promise<boolean> {
    return db.deleteLecturer(id);
  }

  // Departments
  async listDepartments(): Promise<DepartmentDto[]> {
    return db.listDepartments();
  }

  async createDepartment(data: Omit<DepartmentDto, 'id'>): Promise<DepartmentDto> {
    return db.createDepartment(data);
  }

  async updateDepartment(id: string, patch: Partial<DepartmentDto>): Promise<DepartmentDto> {
    return db.updateDepartment(id, patch);
  }

  async deleteDepartment(id: string): Promise<boolean> {
    return db.deleteDepartment(id);
  }

  // Batch Years
  async listBatchYears(): Promise<BatchYearDto[]> {
    return db.listBatchYears();
  }

  async createBatchYear(data: Omit<BatchYearDto, 'id'>): Promise<BatchYearDto> {
    return db.createBatchYear(data);
  }

  async updateBatchYear(id: string, patch: Partial<BatchYearDto>): Promise<BatchYearDto> {
    return db.updateBatchYear(id, patch);
  }

  async deleteBatchYear(id: string): Promise<boolean> {
    return db.deleteBatchYear(id);
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettingsDto> {
    return db.getSystemSettings();
  }

  async updateSystemSettings(patch: Partial<SystemSettingsDto>): Promise<SystemSettingsDto> {
    return db.updateSystemSettings(patch);
  }

  // Surat
  async getSuratBySubmissionId(submissionId: string): Promise<SuratDto | null> {
    return db.getSuratBySubmissionId(submissionId);
  }

  async generateSurat(submissionId: string, department?: string, batchYear?: string | number): Promise<SuratDto> {
    const existing = await db.getSuratBySubmissionId(submissionId);
    if (existing) return existing;

    const prodiCode = extractProdiCode(department);
    const angkatan = extractAngkatan(batchYear);
    const tahun = new Date().getFullYear();

    // urutan is a global integer sequence; the formatted NN in nomor_surat
    // is zero-padded for display only.
    const urutanNum = await db.getNextSuratUrutan(prodiCode, angkatan, tahun);
    const urutanPad = String(urutanNum).padStart(2, '0');
    const nomorSurat = `${urutanPad}/SPSM/${prodiCode}/${angkatan}/${tahun}`;

    return db.upsertSurat(submissionId, {
      nomorSurat,
      urutan: urutanNum,
      tanggalTerbit: new Date().toISOString(),
    });
  }
}

export const masterDataService = new MasterDataService();
