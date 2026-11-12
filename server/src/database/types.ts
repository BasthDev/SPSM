export type SubmissionStatus =
  | 'drafting'
  | 'pending_lecturer'
  | 'waiting_kaprodi'
  | 'waiting_akademik'
  | 'sk_process'
  | 'sk_issued'
  | 'approved'
  | 'revision'
  | 'rejected';

/** Canonical stored/read status vocabulary (docs/API.md §4).
 *  'approved' is kept as an alias of 'sk_issued' for legacy clients. */
export const CANONICAL_SUBMISSION_STATUSES = [
  'drafting',
  'pending_lecturer',
  'waiting_kaprodi',
  'waiting_akademik',
  'sk_process',
  'sk_issued',
  'revision',
  'rejected',
] as const;

export type CanonicalSubmissionStatus = (typeof CANONICAL_SUBMISSION_STATUSES)[number];

/** Legacy aliases found in old DB documents / API payloads -> canonical status. */
const STATUS_ALIASES: Record<string, CanonicalSubmissionStatus> = {
  approved_lecturer: 'waiting_kaprodi',
  pending_kaprodi: 'waiting_kaprodi',
  approved: 'sk_issued',
};

/**
 * Normalize any status string (canonical, legacy alias, or 'approved')
 * to the canonical vocabulary. Returns null when unrecognized.
 */
export function normalizeSubmissionStatus(status: string | null | undefined): CanonicalSubmissionStatus | null {
  if (!status || typeof status !== 'string') return null;
  const s = status.trim();
  if ((CANONICAL_SUBMISSION_STATUSES as readonly string[]).includes(s)) {
    return s as CanonicalSubmissionStatus;
  }
  return STATUS_ALIASES[s] || null;
}

/** All raw stored values that may represent the given (possibly alias) status. */
export function statusStorageValues(status: string): string[] {
  const canonical = normalizeSubmissionStatus(status);
  if (!canonical) return [status];
  const values = new Set<string>([canonical]);
  for (const [alias, target] of Object.entries(STATUS_ALIASES)) {
    if (target === canonical) values.add(alias);
  }
  return Array.from(values);
}

export interface UserProfileDto {
  id: string;
  userId: string;
  name: string;
  nim: string;
  nimOrNip?: string;
  email: string;
  phone?: string;
  department?: string;
  batchYear?: string | number;
  currentSks?: number;
  academicRequirements?: string;
  avatarUrl?: string | null;
  role?: string;
  thesisUploaded?: boolean;
  hasUploadedThesis?: boolean;
  createdAt?: string;
}

export interface LecturerDto {
  id: string;
  userId?: string;
  name: string;
  nip: string;
  email: string;
  phone?: string;
  departmentId?: string;
  /** Raw department_id value (kept for client compatibility). */
  department?: string;
  expertise?: string;
  quota?: number;
  currentStudents?: number;
  role?: string;
  isActive: boolean;
  /** Legacy aliases kept for older clients. */
  currentAdviseeCount?: number;
  maxAdviseeQuota?: number;
}

export interface SubmissionOptionDto {
  id: string;
  submissionId: string;
  optionNumber: number;
  title: string;
  background: string;
  relevanceTable?: string;
  relevanceVariable?: string;
  relevanceMethodology?: string;
  relevanceNote?: string;
  journalTitle?: string;
  journalAuthor?: string;
  journalYear?: string;
  journalFileId?: string | null;
  isSelected?: boolean;
  isSelectedByLecturer?: boolean;
  reviewNotes?: string;
  revisionNote?: string;
}

export interface ApprovalLogDto {
  id: string;
  submissionId: string;
  actorId: string;
  actorName?: string;
  action: string;
  notes?: string;
  createdAt: string;
}

export interface SuratDto {
  id: string;
  submissionId: string;
  nomorSurat: string;
  urutan: number;
  noDokumen?: string;
  templateSkId?: string | null;
  scannedSkId?: string | null;
  createdAt?: string;
  tanggalTerbit?: string;
  /** Legacy alias of scannedSkId (kept for older clients). */
  fileId?: string | null;
}

export interface SubmissionDto {
  id: string;
  studentId: string;
  advisor1Id?: string | null;
  advisor2Id?: string | null;
  preferredAdvisor1Id?: string | null;
  preferredAdvisor2Id?: string | null;
  status: SubmissionStatus;
  submittedAt: string;
  updatedAt?: string;
  reviewerNotes?: string;
  kaprodiNotes?: string;
  options?: SubmissionOptionDto[];
  student?: UserProfileDto | null;
  advisor1?: LecturerDto | null;
  advisor2?: LecturerDto | null;
  preferredAdvisor1?: LecturerDto | null;
  preferredAdvisor2?: LecturerDto | null;
  surat?: SuratDto | null;
  logs?: ApprovalLogDto[];
}

export interface DepartmentDto {
  id: string;
  name: string;
  code: string;
  faculty?: string;
  isActive: boolean;
}

export interface BatchYearDto {
  id: string;
  year: number | string;
  label?: string;
  isActive: boolean;
}

export interface SystemSettingsDto {
  id: string;
  academicYear: string;
  submissionOpen: boolean;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  minSks?: number;
  requiredTitleCount?: number;
  requiredCourses?: string[];
  maxOptions: number;
  defaultAdvisorQuota?: number;
}

export interface ComparableTitleItem {
  id: string;
  title: string;
  submissionId: string;
}

/**
 * Universal Database Adapter Interface
 * All database operations MUST conform to this contract.
 * Migrating from Appwrite to PostgreSQL / Supabase only requires implementing this interface.
 */
export interface IDatabaseAdapter {
  // Submissions
  createSubmission(data: {
    studentId: string;
    preferredAdvisor1Id?: string | null;
    preferredAdvisor2Id?: string | null;
    advisor1Id?: string | null;
    advisor2Id?: string | null;
    status: SubmissionStatus;
    submittedAt?: string;
  }): Promise<SubmissionDto>;

  getSubmissionById(id: string): Promise<SubmissionDto | null>;
  updateSubmission(id: string, patch: Partial<SubmissionDto>): Promise<SubmissionDto>;
  deleteSubmission(id: string): Promise<boolean>;
  listSubmissions(filter?: {
    status?: string;
    studentId?: string;
    advisorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SubmissionDto[]>;
  getAllActiveTitles(): Promise<ComparableTitleItem[]>;

  // Options
  createSubmissionOption(data: Omit<SubmissionOptionDto, 'id'>): Promise<SubmissionOptionDto>;
  getOptionsBySubmissionId(submissionId: string): Promise<SubmissionOptionDto[]>;
  updateSubmissionOption(id: string, patch: Partial<SubmissionOptionDto>): Promise<SubmissionOptionDto>;
  deleteSubmissionOption(id: string): Promise<boolean>;
  deleteOptionsBySubmissionId(submissionId: string): Promise<boolean>;

  // Approval Logs
  createApprovalLog(data: Omit<ApprovalLogDto, 'id' | 'createdAt'> & { createdAt?: string }): Promise<ApprovalLogDto>;
  getApprovalLogsBySubmissionId(submissionId: string): Promise<ApprovalLogDto[]>;

  // Surat
  getSuratBySubmissionId(submissionId: string): Promise<SuratDto | null>;
  upsertSurat(submissionId: string, data: Partial<Omit<SuratDto, 'id' | 'submissionId'>>): Promise<SuratDto>;
  getNextSuratUrutan(prodiCode?: string, angkatan?: string, tahun?: number): Promise<number>;

  // Users
  getUserProfileById(id: string): Promise<UserProfileDto | null>;
  getUserProfileByUserId(userId: string): Promise<UserProfileDto | null>;
  getUserProfileByEmail(email: string): Promise<UserProfileDto | null>;
  createUserProfile(data: Omit<UserProfileDto, 'id'>): Promise<UserProfileDto>;
  updateUserProfile(id: string, patch: Partial<UserProfileDto>): Promise<UserProfileDto>;
  listUsers(limit?: number): Promise<UserProfileDto[]>;

  // Lecturers
  listLecturers(filter?: { activeOnly?: boolean; department?: string }): Promise<LecturerDto[]>;
  getLecturerById(id: string): Promise<LecturerDto | null>;
  getLecturerByEmail(email: string): Promise<LecturerDto | null>;
  getLecturerByNip(nip: string): Promise<LecturerDto | null>;
  createLecturer(data: Omit<LecturerDto, 'id'>): Promise<LecturerDto>;
  updateLecturer(id: string, patch: Partial<LecturerDto>): Promise<LecturerDto>;
  deleteLecturer(id: string): Promise<boolean>;

  // Master Data
  listDepartments(): Promise<DepartmentDto[]>;
  createDepartment(data: Omit<DepartmentDto, 'id'>): Promise<DepartmentDto>;
  updateDepartment(id: string, patch: Partial<DepartmentDto>): Promise<DepartmentDto>;
  deleteDepartment(id: string): Promise<boolean>;

  listBatchYears(): Promise<BatchYearDto[]>;
  createBatchYear(data: Omit<BatchYearDto, 'id'>): Promise<BatchYearDto>;
  updateBatchYear(id: string, patch: Partial<BatchYearDto>): Promise<BatchYearDto>;
  deleteBatchYear(id: string): Promise<boolean>;

  // System Settings
  getSystemSettings(): Promise<SystemSettingsDto>;
  updateSystemSettings(patch: Partial<SystemSettingsDto>): Promise<SystemSettingsDto>;
}
