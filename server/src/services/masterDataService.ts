import { db } from '../database';
import {
  LecturerDto,
  DepartmentDto,
  BatchYearDto,
  SystemSettingsDto,
  SuratDto,
} from '../database/types';

const PRODI_CODE_MAP: Record<string, string> = {
  'ILMU HUKUM': 'IH',
  'AKUNTANSI': 'AKT',
  'MANAJEMEN': 'MNJ',
  'BISNIS DIGITAL': 'BD',
  'KEWIRAUSAHAAN': 'KWU',
  'AGRIBISNIS': 'AGB',
  'ARSITEKTUR': 'ARS',
  'TEKNIK SIPIL': 'TSI',
  'MANAJEMEN BENCANA': 'MBN',
  'PENDIDIKAN AGAMA ISLAM': 'PAI',
  'TADRIS BAHASA INGGRIS': 'TBI',
  'TADRIS BIOLOGI': 'TBO',
  'TADRIS MATEMATIKA': 'TMK',
  'PERBANKAN SYARIAH': 'PBS',
  'ILMU KESEHATAN MASYARAKAT': 'IKM',
  'PSIKOLOGI': 'PSI',
  'PERHOTELAN': 'PHO',
  'FISIOTERAPI': 'FIS',
};

export function extractProdiCode(dept?: string): string {
  if (!dept) return 'UNM';
  const clean = dept.trim().toUpperCase();
  const mapped = PRODI_CODE_MAP[clean];
  if (mapped) return mapped;
  if (clean.length <= 4) return clean;
  return clean.split(' ').map((w) => w[0]).join('').slice(0, 4) || 'UNM';
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
