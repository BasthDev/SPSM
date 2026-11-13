import { Client, Databases, Query, ID } from 'node-appwrite';
import { config } from '../config';
import {
  IDatabaseAdapter,
  SubmissionDto,
  SubmissionOptionDto,
  ApprovalLogDto,
  SuratDto,
  UserProfileDto,
  LecturerDto,
  DepartmentDto,
  BatchYearDto,
  SystemSettingsDto,
  ComparableTitleItem,
  SubmissionStatus,
  normalizeSubmissionStatus,
  statusStorageValues,
} from './types';

function toInt(value: any, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

export class AppwriteAdapter implements IDatabaseAdapter {
  private client: Client;
  private databases: Databases;
  private dbId: string;
  private col: typeof config.appwrite.collections;

  constructor() {
    this.client = new Client()
      .setEndpoint(config.appwrite.endpoint)
      .setProject(config.appwrite.projectId)
      .setKey(config.appwrite.apiKey);

    this.databases = new Databases(this.client);
    this.dbId = config.appwrite.databaseId;
    this.col = config.appwrite.collections;
  }

  // --- Submissions ---

  async createSubmission(data: {
    studentId: string;
    preferredAdvisor1Id?: string | null;
    preferredAdvisor2Id?: string | null;
    advisor1Id?: string | null;
    advisor2Id?: string | null;
    status: SubmissionStatus;
    submittedAt?: string;
  }): Promise<SubmissionDto> {
    const status = normalizeSubmissionStatus(data.status) || 'pending_lecturer';
    const advisor1 = data.advisor1Id || null;
    const advisor2 = data.advisor2Id || null;
    const doc = await this.databases.createDocument(
      this.dbId,
      this.col.submissions,
      ID.unique(),
      {
        student_id: data.studentId,
        advisor_1_id: advisor1,
        advisor_2_id: advisor2,
        advisor_id: advisor1 && advisor2 ? `${advisor1},${advisor2}` : (advisor1 || advisor2 || null),
        preferred_advisor_1_id: data.preferredAdvisor1Id || null,
        preferred_advisor_2_id: data.preferredAdvisor2Id || null,
        status,
        submitted_at: data.submittedAt || new Date().toISOString(),
      }
    );
    return this.mapSubmission(doc);
  }

  async getSubmissionById(id: string): Promise<SubmissionDto | null> {
    try {
      const doc = await this.databases.getDocument(this.dbId, this.col.submissions, id);
      return this.mapSubmission(doc);
    } catch {
      return null;
    }
  }

  async updateSubmission(id: string, patch: Partial<SubmissionDto>): Promise<SubmissionDto> {
    const payload: Record<string, any> = {};
    if (patch.status !== undefined) {
      const normalized = normalizeSubmissionStatus(patch.status);
      if (!normalized) {
        const err: any = new Error(`Status tidak valid: ${patch.status}`);
        err.statusCode = 400;
        throw err;
      }
      payload.status = normalized;
    }
    if (patch.advisor1Id !== undefined) payload.advisor_1_id = patch.advisor1Id;
    if (patch.advisor2Id !== undefined) payload.advisor_2_id = patch.advisor2Id;
    if (patch.advisor1Id !== undefined || patch.advisor2Id !== undefined) {
      // Recompute legacy CSV advisor_id only from advisor_1_id/advisor_2_id.
      // A raw `advisorId` patch is deliberately ignored to avoid corruption.
      const a1 = patch.advisor1Id ?? '';
      const a2 = patch.advisor2Id ?? '';
      payload.advisor_id = a1 && a2 ? `${a1},${a2}` : (a1 || a2 || null);
    }
    if (patch.reviewerNotes !== undefined) payload.reviewer_notes = patch.reviewerNotes;
    if (patch.kaprodiNotes !== undefined) payload.kaprodi_notes = patch.kaprodiNotes;
    if (patch.preferredAdvisor1Id !== undefined) payload.preferred_advisor_1_id = patch.preferredAdvisor1Id;
    if (patch.preferredAdvisor2Id !== undefined) payload.preferred_advisor_2_id = patch.preferredAdvisor2Id;
    if (patch.studentId !== undefined) payload.student_id = patch.studentId;

    const doc = await this.databases.updateDocument(this.dbId, this.col.submissions, id, payload);
    return this.mapSubmission(doc);
  }

  async deleteSubmission(id: string): Promise<boolean> {
    await this.databases.deleteDocument(this.dbId, this.col.submissions, id);
    return true;
  }

  async listSubmissions(filter?: {
    status?: string;
    studentId?: string;
    advisorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SubmissionDto[]> {
    const limit = Math.min(Math.max(filter?.limit ?? 500, 1), 1000);
    const offset = Math.max(filter?.offset ?? 0, 0);
    const queries: string[] = [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc('submitted_at'),
    ];
    if (filter?.status) {
      const values = statusStorageValues(filter.status);
      queries.push(
        values.length === 1
          ? Query.equal('status', values[0])
          : Query.or(values.map((v) => Query.equal('status', v)))
      );
    }
    if (filter?.studentId) {
      queries.push(Query.equal('student_id', filter.studentId));
    }
    if (filter?.advisorId) {
      queries.push(
        Query.or([
          Query.equal('advisor_1_id', filter.advisorId),
          Query.equal('advisor_2_id', filter.advisorId),
        ])
      );
    }

    const res = await this.databases.listDocuments(this.dbId, this.col.submissions, queries);
    return res.documents.map((d) => this.mapSubmission(d));
  }

  async getAllActiveTitles(): Promise<ComparableTitleItem[]> {
    try {
      // Get all submission options with non-empty titles
      const optRes = await this.databases.listDocuments(this.dbId, this.col.options, [
        Query.limit(1000),
      ]);

      const options = optRes.documents.filter(
        (opt: any) => opt.title && String(opt.title).trim().length > 0
      );
      if (options.length === 0) return [];

      // Exclude titles whose submission is rejected or needs revision.
      // Single list call instead of N+1 document fetches.
      const excluded = new Set<string>();
      try {
        const subRes = await this.databases.listDocuments(this.dbId, this.col.submissions, [
          Query.limit(1000),
          Query.or([
            Query.equal('status', 'rejected'),
            Query.equal('status', 'revision'),
          ]),
        ]);
        for (const s of subRes.documents) {
          excluded.add((s as any).$id);
        }
      } catch (e) {
        console.warn('Failed to fetch rejected/revision submissions for title filter:', e);
      }

      return options
        .filter((opt: any) => !excluded.has(opt.submission_id))
        .map((opt: any) => ({
          id: opt.$id,
          title: String(opt.title).trim(),
          submissionId: opt.submission_id,
        }));
    } catch (err) {
      console.error('Failed to get active titles for similarity check:', err);
      return [];
    }
  }

  // --- Options ---

  async createSubmissionOption(data: Omit<SubmissionOptionDto, 'id'>): Promise<SubmissionOptionDto> {
    const doc = await this.databases.createDocument(
      this.dbId,
      this.col.options,
      ID.unique(),
      {
        submission_id: data.submissionId,
        option_number: data.optionNumber,
        title: data.title,
        background: data.background || '',
        relevance_table: data.relevanceTable || '',
        relevance_variable: data.relevanceVariable || '',
        relevance_methodology: data.relevanceMethodology || '',
        relevance_note: data.relevanceNote || '',
        journal_title: data.journalTitle || '',
        journal_author: data.journalAuthor || '',
        journal_year: data.journalYear || '',
        journal_file_id: data.journalFileId || null,
        is_selected: data.isSelected || false,
        is_selected_by_lecturer: data.isSelectedByLecturer ?? data.isSelected ?? false,
        lecturer_notes: data.reviewNotes || null,
      }
    );
    return this.mapOption(doc);
  }

  async getOptionsBySubmissionId(submissionId: string): Promise<SubmissionOptionDto[]> {
    const res = await this.databases.listDocuments(this.dbId, this.col.options, [
      Query.equal('submission_id', submissionId),
      Query.orderAsc('option_number'),
    ]);
    return res.documents.map((d) => this.mapOption(d));
  }

  async updateSubmissionOption(id: string, patch: Partial<SubmissionOptionDto>): Promise<SubmissionOptionDto> {
    const payload: Record<string, any> = {};
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.background !== undefined) payload.background = patch.background;
    if (patch.relevanceTable !== undefined) payload.relevance_table = patch.relevanceTable;
    if (patch.relevanceVariable !== undefined) payload.relevance_variable = patch.relevanceVariable;
    if (patch.relevanceMethodology !== undefined) payload.relevance_methodology = patch.relevanceMethodology;
    if (patch.relevanceNote !== undefined) payload.relevance_note = patch.relevanceNote;
    if (patch.journalTitle !== undefined) payload.journal_title = patch.journalTitle;
    if (patch.journalAuthor !== undefined) payload.journal_author = patch.journalAuthor;
    if (patch.journalYear !== undefined) payload.journal_year = patch.journalYear;
    if (patch.journalFileId !== undefined) payload.journal_file_id = patch.journalFileId;
    if (patch.isSelected !== undefined) payload.is_selected = patch.isSelected;
    if (patch.isSelectedByLecturer !== undefined) payload.is_selected_by_lecturer = patch.isSelectedByLecturer;
    if (patch.reviewNotes !== undefined) payload.lecturer_notes = patch.reviewNotes;
    if (patch.optionNumber !== undefined) payload.option_number = patch.optionNumber;

    const doc = await this.databases.updateDocument(this.dbId, this.col.options, id, payload);
    return this.mapOption(doc);
  }

  async deleteSubmissionOption(id: string): Promise<boolean> {
    await this.databases.deleteDocument(this.dbId, this.col.options, id);
    return true;
  }

  async deleteOptionsBySubmissionId(submissionId: string): Promise<boolean> {
    const res = await this.databases.listDocuments(this.dbId, this.col.options, [
      Query.equal('submission_id', submissionId),
    ]);
    for (const doc of res.documents) {
      await this.databases.deleteDocument(this.dbId, this.col.options, doc.$id);
    }
    return true;
  }

  // --- Approval Logs ---

  async createApprovalLog(
    data: Omit<ApprovalLogDto, 'id' | 'createdAt'> & { createdAt?: string }
  ): Promise<ApprovalLogDto> {
    const doc = await this.databases.createDocument(
      this.dbId,
      this.col.approvalLogs,
      ID.unique(),
      {
        submission_id: data.submissionId,
        actor_id: data.actorId,
        action: data.action,
        notes: data.notes || '',
        created_at: data.createdAt || new Date().toISOString(),
      }
    );
    return this.mapLog(doc);
  }

  async getApprovalLogsBySubmissionId(submissionId: string): Promise<ApprovalLogDto[]> {
    const res = await this.databases.listDocuments(this.dbId, this.col.approvalLogs, [
      Query.equal('submission_id', submissionId),
      Query.orderAsc('created_at'),
    ]);
    return res.documents.map((d) => this.mapLog(d));
  }

  // --- Surat ---

  async getSuratBySubmissionId(submissionId: string): Promise<SuratDto | null> {
    const res = await this.databases.listDocuments(this.dbId, this.col.surat, [
      Query.equal('submission_id', submissionId),
      Query.limit(1),
    ]);
    if (res.documents.length === 0) return null;
    return this.mapSurat(res.documents[0]);
  }

  async upsertSurat(
    submissionId: string,
    data: Partial<Omit<SuratDto, 'id' | 'submissionId'>>
  ): Promise<SuratDto> {
    const existing = await this.getSuratBySubmissionId(submissionId);

    // Build payload only from provided fields so partial updates
    // (e.g. scanned_sk_id) don't wipe nomor_surat / urutan.
    const payload: Record<string, any> = { submission_id: submissionId };
    if (data.nomorSurat !== undefined) payload.nomor_surat = data.nomorSurat;
    if (data.urutan !== undefined) payload.urutan = toInt(data.urutan, 1);
    if (data.noDokumen !== undefined) payload.no_dokumen = data.noDokumen;
    if (data.templateSkId !== undefined) payload.template_sk_id = data.templateSkId;
    const scannedSkId = data.scannedSkId ?? data.fileId;
    if (scannedSkId !== undefined) payload.scanned_sk_id = scannedSkId;
    if (data.tanggalTerbit !== undefined) payload.created_at = data.tanggalTerbit;
    if (data.createdAt !== undefined) payload.created_at = data.createdAt;

    if (existing) {
      // Ensure required attrs exist on legacy docs missing them
      if (payload.nomor_surat === undefined && !existing.nomorSurat) {
        payload.nomor_surat = '';
      }
      const doc = await this.databases.updateDocument(this.dbId, this.col.surat, existing.id, payload);
      return this.mapSurat(doc);
    } else {
      // Required attrs on create: nomor_surat, urutan, no_dokumen, created_at
      if (payload.nomor_surat === undefined) payload.nomor_surat = data.nomorSurat || '';
      if (payload.urutan === undefined) payload.urutan = toInt(data.urutan, 1);
      if (payload.no_dokumen === undefined) {
        payload.no_dokumen = data.noDokumen || `SPSM-${String(submissionId).slice(-8).toUpperCase()}`;
      }
      if (payload.created_at === undefined) payload.created_at = new Date().toISOString();
      const doc = await this.databases.createDocument(this.dbId, this.col.surat, ID.unique(), payload);
      return this.mapSurat(doc);
    }
  }

  /**
   * urutan is a GLOBAL integer sequence (there are no prodi/angkatan columns).
   * We keep the signature for compatibility but return max(urutan)+1 across
   * all surat documents — the sequence embedded in nomor_surat remains
   * per prodi/angkatan/tahun via the formatted number string.
   */
  async getNextSuratUrutan(_prodiCode?: string, _angkatan?: string, _tahun?: number): Promise<number> {
    try {
      const res = await this.databases.listDocuments(this.dbId, this.col.surat, [
        Query.orderDesc('urutan'),
        Query.limit(1),
      ]);
      if (res.documents.length > 0) {
        const lastUrutan = toInt((res.documents[0] as any).urutan, 0);
        return lastUrutan + 1;
      }
    } catch (e) {
      console.warn('Error fetching last urutan, fallback to 1:', e);
    }
    return 1;
  }

  // --- Users ---

  async getUserProfileById(id: string): Promise<UserProfileDto | null> {
    try {
      const doc = await this.databases.getDocument(this.dbId, this.col.users, id);
      return this.mapUser(doc);
    } catch {
      return null;
    }
  }

  async getUserProfileByUserId(userId: string): Promise<UserProfileDto | null> {
    const res = await this.databases.listDocuments(this.dbId, this.col.users, [
      Query.equal('user_id', userId),
      Query.limit(1),
    ]);
    if (res.documents.length === 0) return null;
    return this.mapUser(res.documents[0]);
  }

  async getUserProfileByEmail(email: string): Promise<UserProfileDto | null> {
    const res = await this.databases.listDocuments(this.dbId, this.col.users, [
      Query.equal('email', email.toLowerCase().trim()),
      Query.limit(1),
    ]);
    if (res.documents.length === 0) return null;
    return this.mapUser(res.documents[0]);
  }

  async createUserProfile(data: Omit<UserProfileDto, 'id'>): Promise<UserProfileDto> {
    const nimOrNip = (data.nimOrNip || data.nim || '').toString();
    const doc = await this.databases.createDocument(
      this.dbId,
      this.col.users,
      ID.unique(),
      {
        user_id: data.userId,
        name: data.name || '',
        email: (data.email || '').toLowerCase().trim(),
        role: data.role || 'student',
        nim_or_nip: nimOrNip,
        department: data.department || '',
        batch_year: toInt(data.batchYear, 0) || undefined,
        current_sks: toInt(data.currentSks, 0),
        academic_requirements: data.academicRequirements || '',
        avatar_url: data.avatarUrl || null,
        phone: data.phone || '',
        has_uploaded_thesis: Boolean(data.thesisUploaded ?? data.hasUploadedThesis),
        created_at: data.createdAt || new Date().toISOString(),
      }
    );
    return this.mapUser(doc);
  }

  async updateUserProfile(id: string, patch: Partial<UserProfileDto>): Promise<UserProfileDto> {
    const payload: Record<string, any> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.email !== undefined) payload.email = String(patch.email).toLowerCase().trim();
    const nimOrNip = patch.nimOrNip ?? patch.nim;
    if (nimOrNip !== undefined) payload.nim_or_nip = String(nimOrNip);
    if (patch.department !== undefined) payload.department = patch.department;
    if (patch.batchYear !== undefined) payload.batch_year = toInt(patch.batchYear, 0);
    if (patch.currentSks !== undefined) payload.current_sks = toInt(patch.currentSks, 0);
    if (patch.academicRequirements !== undefined) payload.academic_requirements = patch.academicRequirements;
    if (patch.avatarUrl !== undefined) payload.avatar_url = patch.avatarUrl;
    if ((patch as any).pushToken !== undefined) payload.push_token = (patch as any).pushToken || null;
    if (patch.phone !== undefined) payload.phone = String(patch.phone).trim();
    const thesisFlag = patch.thesisUploaded ?? patch.hasUploadedThesis ?? (patch as any).has_uploaded_thesis;
    if (thesisFlag !== undefined) payload.has_uploaded_thesis = Boolean(thesisFlag);
    if (patch.role !== undefined) payload.role = patch.role;

    const doc = await this.databases.updateDocument(this.dbId, this.col.users, id, payload);
    return this.mapUser(doc);
  }

  async listUsers(limit = 500): Promise<UserProfileDto[]> {
    const res = await this.databases.listDocuments(this.dbId, this.col.users, [
      Query.limit(Math.min(Math.max(limit, 1), 1000)),
      Query.orderDesc('$createdAt'),
    ]);
    return res.documents.map((d) => this.mapUser(d));
  }

  // --- Lecturers ---

  async listLecturers(filter?: { activeOnly?: boolean; department?: string }): Promise<LecturerDto[]> {
    const queries: string[] = [Query.limit(500)];
    if (filter?.activeOnly) {
      queries.push(Query.equal('is_active', true));
    }
    if (filter?.department) {
      // department filter matches department_id (doc id / code)
      queries.push(Query.equal('department_id', filter.department));
    }
    const res = await this.databases.listDocuments(this.dbId, this.col.lecturers, queries);
    return res.documents.map((d) => this.mapLecturer(d));
  }

  async getLecturerById(id: string): Promise<LecturerDto | null> {
    try {
      const doc = await this.databases.getDocument(this.dbId, this.col.lecturers, id);
      return this.mapLecturer(doc);
    } catch {
      return null;
    }
  }

  async getLecturerByEmail(email: string): Promise<LecturerDto | null> {
    const res = await this.databases.listDocuments(this.dbId, this.col.lecturers, [
      Query.equal('email', email.toLowerCase().trim()),
      Query.limit(1),
    ]);
    if (res.documents.length === 0) return null;
    return this.mapLecturer(res.documents[0]);
  }

  async getLecturerByNip(nip: string): Promise<LecturerDto | null> {
    const res = await this.databases.listDocuments(this.dbId, this.col.lecturers, [
      Query.equal('nip', nip.trim()),
      Query.limit(1),
    ]);
    if (res.documents.length === 0) return null;
    return this.mapLecturer(res.documents[0]);
  }

  async createLecturer(data: Omit<LecturerDto, 'id'>): Promise<LecturerDto> {
    const quota = toInt(data.quota ?? data.maxAdviseeQuota, 10);
    const currentStudents = toInt(data.currentStudents ?? data.currentAdviseeCount, 0);
    const doc = await this.databases.createDocument(
      this.dbId,
      this.col.lecturers,
      ID.unique(),
      {
        user_id: data.userId || null,
        nip: data.nip,
        name: data.name,
        email: (data.email || '').toLowerCase().trim(),
        department_id: data.departmentId || data.department || '',
        expertise: data.expertise || '',
        quota,
        current_students: currentStudents,
        role: data.role || 'lecturer',
        is_active: data.isActive ?? true,
      }
    );
    return this.mapLecturer(doc);
  }

  async updateLecturer(id: string, patch: Partial<LecturerDto>): Promise<LecturerDto> {
    const payload: Record<string, any> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.nip !== undefined) payload.nip = patch.nip;
    if (patch.email !== undefined) payload.email = patch.email.toLowerCase().trim();
    if (patch.userId !== undefined) payload.user_id = patch.userId;
    const dept = patch.departmentId ?? patch.department;
    if (dept !== undefined) payload.department_id = dept;
    if (patch.expertise !== undefined) payload.expertise = patch.expertise;
    const quota = patch.quota ?? patch.maxAdviseeQuota;
    if (quota !== undefined) payload.quota = toInt(quota, 10);
    const currentStudents = patch.currentStudents ?? patch.currentAdviseeCount;
    if (currentStudents !== undefined) payload.current_students = toInt(currentStudents, 0);
    if (patch.role !== undefined) payload.role = patch.role;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    // phone has no column in the lecturers collection — intentionally dropped.

    const doc = await this.databases.updateDocument(this.dbId, this.col.lecturers, id, payload);
    return this.mapLecturer(doc);
  }

  async deleteLecturer(id: string): Promise<boolean> {
    await this.databases.deleteDocument(this.dbId, this.col.lecturers, id);
    return true;
  }

  // --- Departments & Batch Years ---

  async listDepartments(): Promise<DepartmentDto[]> {
    const res = await this.databases.listDocuments(this.dbId, this.col.departments, [Query.limit(200)]);
    return res.documents
      .filter((d: any) => d.code && !String(d.name || '').trim().startsWith('{'))
      .map((d: any) => this.mapDepartment(d));
  }

  async createDepartment(data: Omit<DepartmentDto, 'id'>): Promise<DepartmentDto> {
    const doc = await this.databases.createDocument(this.dbId, this.col.departments, ID.unique(), {
      name: data.name,
      code: data.code,
      faculty: data.faculty || '',
      is_active: data.isActive ?? true,
    });
    return this.mapDepartment(doc);
  }

  async updateDepartment(id: string, patch: Partial<DepartmentDto>): Promise<DepartmentDto> {
    const payload: any = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.code !== undefined) payload.code = patch.code;
    if (patch.faculty !== undefined) payload.faculty = patch.faculty;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    const doc = await this.databases.updateDocument(this.dbId, this.col.departments, id, payload);
    return this.mapDepartment(doc);
  }

  async deleteDepartment(id: string): Promise<boolean> {
    await this.databases.deleteDocument(this.dbId, this.col.departments, id);
    return true;
  }

  async listBatchYears(): Promise<BatchYearDto[]> {
    const res = await this.databases.listDocuments(this.dbId, this.col.batchYears, [Query.limit(200)]);
    return res.documents.map((d: any) => this.mapBatchYear(d));
  }

  async createBatchYear(data: Omit<BatchYearDto, 'id'>): Promise<BatchYearDto> {
    const doc = await this.databases.createDocument(this.dbId, this.col.batchYears, ID.unique(), {
      year: toInt(data.year, new Date().getFullYear()),
      label: data.label || `Angkatan ${data.year}`,
      is_active: data.isActive ?? true,
    });
    return this.mapBatchYear(doc);
  }

  async updateBatchYear(id: string, patch: Partial<BatchYearDto>): Promise<BatchYearDto> {
    const payload: any = {};
    if (patch.year !== undefined) payload.year = toInt(patch.year, 0);
    if (patch.label !== undefined) payload.label = patch.label;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    const doc = await this.databases.updateDocument(this.dbId, this.col.batchYears, id, payload);
    return this.mapBatchYear(doc);
  }

  async deleteBatchYear(id: string): Promise<boolean> {
    await this.databases.deleteDocument(this.dbId, this.col.batchYears, id);
    return true;
  }

  // --- System Settings ---

  private mapSettingsDoc(d: any): SystemSettingsDto {
    const isActive = d.is_active ?? true;
    const requiredTitleCount = toInt(d.required_title_count, 3);
    return {
      id: d.$id,
      academicYear: d.academic_year || '2025/2026 Ganjil',
      submissionOpen: isActive,
      isActive,
      startDate: d.start_date || '',
      endDate: d.end_date || '',
      minSks: typeof d.min_sks === 'number' ? d.min_sks : toInt(d.min_sks, 100),
      requiredTitleCount,
      requiredCourses: Array.isArray(d.required_courses) ? d.required_courses : [],
      // maxOptions mirrors required_title_count (same underlying attribute)
      maxOptions: requiredTitleCount,
      defaultAdvisorQuota: 10,
    };
  }

  async getSystemSettings(): Promise<SystemSettingsDto> {
    const res = await this.databases.listDocuments(this.dbId, this.col.systemSettings, [Query.limit(1)]);
    if (res.documents.length === 0) {
      // Return defaults if none
      return {
        id: 'default',
        academicYear: '2025/2026 Ganjil',
        submissionOpen: true,
        isActive: true,
        startDate: '',
        endDate: '',
        minSks: 100,
        requiredTitleCount: 3,
        requiredCourses: [],
        maxOptions: 3,
        defaultAdvisorQuota: 10,
      };
    }
    return this.mapSettingsDoc(res.documents[0]);
  }

  async updateSystemSettings(patch: Partial<SystemSettingsDto>): Promise<SystemSettingsDto> {
    const current = await this.getSystemSettings();
    const payload: any = {};
    if (patch.academicYear !== undefined) payload.academic_year = patch.academicYear;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    if (patch.submissionOpen !== undefined) payload.is_active = patch.submissionOpen;
    if (patch.startDate !== undefined) payload.start_date = patch.startDate;
    if (patch.endDate !== undefined) payload.end_date = patch.endDate;
    if (patch.minSks !== undefined) payload.min_sks = toInt(patch.minSks, 100);
    // requiredTitleCount and maxOptions both map to required_title_count
    // (they represent the same N; last-write-wins).
    if (patch.requiredTitleCount !== undefined) payload.required_title_count = toInt(patch.requiredTitleCount, 3);
    if (patch.maxOptions !== undefined) payload.required_title_count = toInt(patch.maxOptions, 3);
    if (patch.requiredCourses !== undefined) payload.required_courses = patch.requiredCourses;

    let doc: any;
    if (current.id && current.id !== 'default') {
      doc = await this.databases.updateDocument(this.dbId, this.col.systemSettings, current.id, payload);
    } else {
      doc = await this.databases.createDocument(this.dbId, this.col.systemSettings, ID.unique(), {
        is_active: payload.is_active ?? true,
        academic_year: payload.academic_year ?? '2025/2026 Ganjil',
        start_date: payload.start_date ?? '',
        end_date: payload.end_date ?? '',
        min_sks: payload.min_sks ?? 100,
        required_title_count: payload.required_title_count ?? 3,
        required_courses: payload.required_courses ?? [],
      });
    }

    return this.mapSettingsDoc(doc);
  }

  async listRecentDocuments(collectionId: string, limit = 50): Promise<any[]> {
    const res = await this.databases.listDocuments(this.dbId, collectionId, [
      Query.orderDesc('$updatedAt'),
      Query.limit(Math.min(Math.max(limit, 1), 200)),
    ]);
    return res.documents;
  }

  // --- Mappers (DTO Boundary) ---

  private mapSubmission(doc: any): SubmissionDto {
    return {
      id: doc.$id,
      studentId: doc.student_id,
      advisor1Id: doc.advisor_1_id || null,
      advisor2Id: doc.advisor_2_id || null,
      preferredAdvisor1Id: doc.preferred_advisor_1_id || null,
      preferredAdvisor2Id: doc.preferred_advisor_2_id || null,
      // Always emit canonical status; legacy aliases are normalized on read.
      status: (normalizeSubmissionStatus(doc.status) || 'pending_lecturer') as SubmissionStatus,
      submittedAt: doc.submitted_at || doc.$createdAt,
      updatedAt: doc.$updatedAt,
      reviewerNotes: doc.reviewer_notes || '',
      kaprodiNotes: doc.kaprodi_notes || '',
    };
  }

  private mapOption(doc: any): SubmissionOptionDto {
    const isSelectedByLecturer =
      doc.is_selected_by_lecturer !== undefined
        ? Boolean(doc.is_selected_by_lecturer)
        : Boolean(doc.is_selected);
    return {
      id: doc.$id,
      submissionId: doc.submission_id,
      optionNumber: doc.option_number,
      title: doc.title,
      background: doc.background || '',
      relevanceTable: doc.relevance_table,
      relevanceVariable: doc.relevance_variable,
      relevanceMethodology: doc.relevance_methodology,
      relevanceNote: doc.relevance_note,
      journalTitle: doc.journal_title,
      journalAuthor: doc.journal_author,
      journalYear: doc.journal_year,
      journalFileId: doc.journal_file_id || null,
      isSelected: doc.is_selected || false,
      isSelectedByLecturer,
      reviewNotes: doc.lecturer_notes || doc.review_notes || '',
    };
  }

  private mapLog(doc: any): ApprovalLogDto {
    return {
      id: doc.$id,
      submissionId: doc.submission_id,
      actorId: doc.actor_id,
      action: doc.action,
      notes: doc.notes,
      createdAt: doc.created_at || doc.$createdAt,
    };
  }

  private mapSurat(doc: any): SuratDto {
    const scannedSkId = doc.scanned_sk_id || null;
    return {
      id: doc.$id,
      submissionId: doc.submission_id,
      nomorSurat: doc.nomor_surat || '',
      urutan: toInt(doc.urutan, 0),
      noDokumen: doc.no_dokumen || undefined,
      templateSkId: doc.template_sk_id || null,
      scannedSkId,
      createdAt: doc.created_at || doc.$createdAt,
      tanggalTerbit: doc.created_at || doc.$createdAt,
      // Legacy alias used by older web_app mapping
      fileId: scannedSkId,
    };
  }

  private mapUser(doc: any): UserProfileDto {
    const thesisUploaded = Boolean(doc.has_uploaded_thesis ?? doc.thesis_uploaded);
    const nimOrNip = doc.nim_or_nip || doc.nim || '';
    return {
      id: doc.$id,
      userId: doc.user_id,
      name: doc.name,
      nim: nimOrNip,
      nimOrNip,
      email: doc.email,
      phone: doc.phone,
      department: doc.department,
      batchYear: doc.batch_year,
      currentSks: toInt(doc.current_sks, 0),
      academicRequirements: doc.academic_requirements || '',
      avatarUrl: doc.avatar_url || null,
      pushToken: doc.push_token || null,
      role: doc.role || 'student',
      thesisUploaded,
      hasUploadedThesis: thesisUploaded,
      createdAt: doc.created_at || doc.$createdAt,
    };
  }

  private mapLecturer(doc: any): LecturerDto {
    const quota = toInt(doc.quota, 10);
    const currentStudents = toInt(doc.current_students, 0);
    return {
      id: doc.$id,
      userId: doc.user_id || undefined,
      name: doc.name,
      nip: doc.nip,
      email: doc.email,
      phone: doc.phone,
      departmentId: doc.department_id || undefined,
      // Raw department_id kept under `department` for client compatibility
      department: doc.department_id || undefined,
      expertise: doc.expertise || undefined,
      quota,
      currentStudents,
      role: doc.role || 'lecturer',
      isActive: doc.is_active ?? true,
      // Legacy aliases for older clients (web_app lecturerService)
      currentAdviseeCount: currentStudents,
      maxAdviseeQuota: quota,
    };
  }

  private mapDepartment(doc: any): DepartmentDto {
    return {
      id: doc.$id,
      name: doc.name,
      code: doc.code,
      faculty: doc.faculty || undefined,
      isActive: doc.is_active ?? true,
    };
  }

  private mapBatchYear(doc: any): BatchYearDto {
    return {
      id: doc.$id,
      year: doc.year,
      label: doc.label || undefined,
      isActive: doc.is_active ?? true,
    };
  }
}
