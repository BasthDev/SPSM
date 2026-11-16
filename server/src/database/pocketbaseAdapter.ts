import PocketBase from 'pocketbase';
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

/**
 * PocketBase adapter — mirrors AppwriteAdapter semantics.
 * Field names intentionally keep the Appwrite snake_case schema so DTO
 * mappers and migrated data stay consistent.
 */
export class PocketBaseAdapter implements IDatabaseAdapter {
  private pb: PocketBase;
  private col: {
    submissions: string;
    options: string;
    approvalLogs: string;
    surat: string;
    users: string;
    lecturers: string;
    departments: string;
    batchYears: string;
    systemSettings: string;
  };

  private authPromise: Promise<void> | null = null;

  constructor() {
    this.pb = new PocketBase(config.pocketbase.url);
    this.pb.autoCancellation(false);
    // Retry admin auth sebelum setiap request (token bisa expired / boot-time gagal).
    // CATATAN: override beforeSend menimpa built-in SDK yang menyuntik header
    // Authorization — jadi token harus disuntik manual di sini.
    this.pb.beforeSend = async (url: string, options: any) => {
      if (!url.includes('/auth-with-password')) {
        await this.ensureAuth().catch(() => {});
      }
      const token = this.pb.authStore.token;
      if (token) {
        options = options || {};
        options.headers = { ...(options.headers || {}), Authorization: token };
      }
      return { url, options };
    };
    void this.ensureAuth().catch(() => {});
    this.col = {
      submissions: 'thesis_submissions',
      options: 'submission_options',
      approvalLogs: 'approval_logs',
      surat: 'surat',
      users: 'users',
      lecturers: 'lecturers',
      departments: 'departments',
      batchYears: 'batch_years',
      systemSettings: 'system_settings',
    };
  }

  private async ensureAuth(): Promise<void> {
    // authStore dipakai bersama dengan record-auth (login user) — token record
    // user juga "valid" tapi BUKAN admin, jadi query koleksi kena rule '' →
    // data kosong. Wajib pastikan token yang tersimpan adalah superuser.
    const rec: any = this.pb.authStore.record;
    if (this.pb.authStore.isValid && rec?.collectionName === '_superusers') return;
    if (!this.authPromise) {
      this.authPromise = this.pb
        .admins.authWithPassword(config.pocketbase.adminEmail, config.pocketbase.adminPassword)
        .then(() => undefined)
        .finally(() => {
          this.authPromise = null;
        });
    }
    await this.authPromise;
  }

  /** PocketBase filter string helpers */
  private eq(field: string, value: any): string {
    if (value === null || value === undefined) return `${field} = ""`;
    if (typeof value === 'number') return `${field} = ${value}`;
    if (typeof value === 'boolean') return `${field} = ${value ? 'true' : 'false'}`;
    return `${field} = "${String(value).replace(/"/g, '\\"')}"`;
  }

  private or(conds: string[]): string {
    return `(${conds.join(' || ')})`;
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
    const doc = await this.pb.collection(this.col.submissions).create({
      student_id: data.studentId,
      advisor_1_id: advisor1,
      advisor_2_id: advisor2,
      advisor_id: advisor1 && advisor2 ? `${advisor1},${advisor2}` : (advisor1 || advisor2 || ''),
      preferred_advisor_1_id: data.preferredAdvisor1Id || '',
      preferred_advisor_2_id: data.preferredAdvisor2Id || '',
      status,
      submitted_at: data.submittedAt || new Date().toISOString(),
    });
    return this.mapSubmission(doc);
  }

  async getSubmissionById(id: string): Promise<SubmissionDto | null> {
    try {
      const doc = await this.pb.collection(this.col.submissions).getOne(id);
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
    if (patch.advisor1Id !== undefined) payload.advisor_1_id = patch.advisor1Id || '';
    if (patch.advisor2Id !== undefined) payload.advisor_2_id = patch.advisor2Id || '';
    if (patch.advisor1Id !== undefined || patch.advisor2Id !== undefined) {
      const a1 = patch.advisor1Id ?? '';
      const a2 = patch.advisor2Id ?? '';
      payload.advisor_id = a1 && a2 ? `${a1},${a2}` : (a1 || a2 || '');
    }
    if (patch.reviewerNotes !== undefined) payload.reviewer_notes = patch.reviewerNotes;
    if (patch.kaprodiNotes !== undefined) payload.kaprodi_notes = patch.kaprodiNotes;
    if (patch.preferredAdvisor1Id !== undefined) payload.preferred_advisor_1_id = patch.preferredAdvisor1Id || '';
    if (patch.preferredAdvisor2Id !== undefined) payload.preferred_advisor_2_id = patch.preferredAdvisor2Id || '';
    if (patch.studentId !== undefined) payload.student_id = patch.studentId;

    const doc = await this.pb.collection(this.col.submissions).update(id, payload);
    return this.mapSubmission(doc);
  }

  async deleteSubmission(id: string): Promise<boolean> {
    await this.pb.collection(this.col.submissions).delete(id);
    return true;
  }

  async listSubmissions(filter?: {
    status?: string;
    studentId?: string;
    advisorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SubmissionDto[]> {
    const conds: string[] = [];
    if (filter?.status) {
      const values = statusStorageValues(filter.status);
      conds.push(values.length === 1 ? this.eq('status', values[0]) : this.or(values.map((v) => this.eq('status', v))));
    }
    if (filter?.studentId) conds.push(this.eq('student_id', filter.studentId));
    if (filter?.advisorId) {
      conds.push(this.or([this.eq('advisor_1_id', filter.advisorId), this.eq('advisor_2_id', filter.advisorId)]));
    }
    const filterStr = conds.length ? conds.join(' && ') : undefined;
    const perPage = Math.min(Math.max(filter?.limit ?? 500, 1), 1000);
    const page = Math.floor(Math.max(filter?.offset ?? 0, 0) / perPage) + 1;
    const res = await this.pb
      .collection(this.col.submissions)
      .getList(page, perPage, { filter: filterStr, sort: '-submitted_at' });
    return res.items.map((d) => this.mapSubmission(d));
  }

  async getAllActiveTitles(): Promise<ComparableTitleItem[]> {
    try {
      const options = await this.pb.collection(this.col.options).getFullList({
        filter: 'title != ""',
      });
      const titled = options.filter((o: any) => o.title && String(o.title).trim().length > 0);
      if (titled.length === 0) return [];

      const excluded = new Set<string>();
      try {
        const subs = await this.pb.collection(this.col.submissions).getFullList({
          filter: this.or([this.eq('status', 'rejected'), this.eq('status', 'revision')]),
        });
        for (const s of subs) excluded.add((s as any).id);
      } catch (e) {
        console.warn('Failed to fetch rejected/revision submissions for title filter:', e);
      }

      return titled
        .filter((o: any) => !excluded.has(o.submission_id))
        .map((o: any) => ({
          id: o.id,
          title: String(o.title).trim(),
          submissionId: o.submission_id,
        }));
    } catch (err) {
      console.error('Failed to get active titles for similarity check:', err);
      return [];
    }
  }

  // --- Options ---

  async createSubmissionOption(data: Omit<SubmissionOptionDto, 'id'>): Promise<SubmissionOptionDto> {
    const doc = await this.pb.collection(this.col.options).create({
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
      journal_file_id: data.journalFileId || '',
      is_selected: data.isSelected || false,
      is_selected_by_lecturer: data.isSelectedByLecturer ?? data.isSelected ?? false,
      lecturer_notes: data.reviewNotes || '',
    });
    return this.mapOption(doc);
  }

  async getOptionsBySubmissionId(submissionId: string): Promise<SubmissionOptionDto[]> {
    const res = await this.pb.collection(this.col.options).getFullList({
      filter: this.eq('submission_id', submissionId),
      sort: 'option_number',
    });
    return res.map((d) => this.mapOption(d));
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
    if (patch.journalFileId !== undefined) payload.journal_file_id = patch.journalFileId || '';
    if (patch.isSelected !== undefined) payload.is_selected = patch.isSelected;
    if (patch.isSelectedByLecturer !== undefined) payload.is_selected_by_lecturer = patch.isSelectedByLecturer;
    if (patch.reviewNotes !== undefined) payload.lecturer_notes = patch.reviewNotes;
    if (patch.optionNumber !== undefined) payload.option_number = patch.optionNumber;

    const doc = await this.pb.collection(this.col.options).update(id, payload);
    return this.mapOption(doc);
  }

  async deleteSubmissionOption(id: string): Promise<boolean> {
    await this.pb.collection(this.col.options).delete(id);
    return true;
  }

  async deleteOptionsBySubmissionId(submissionId: string): Promise<boolean> {
    const res = await this.pb.collection(this.col.options).getFullList({
      filter: this.eq('submission_id', submissionId),
    });
    for (const doc of res) {
      await this.pb.collection(this.col.options).delete(doc.id);
    }
    return true;
  }

  // --- Approval Logs ---

  async createApprovalLog(
    data: Omit<ApprovalLogDto, 'id' | 'createdAt'> & { createdAt?: string }
  ): Promise<ApprovalLogDto> {
    const doc = await this.pb.collection(this.col.approvalLogs).create({
      submission_id: data.submissionId,
      actor_id: data.actorId,
      action: data.action,
      notes: data.notes || '',
      created_at: data.createdAt || new Date().toISOString(),
    });
    return this.mapLog(doc);
  }

  async getApprovalLogsBySubmissionId(submissionId: string): Promise<ApprovalLogDto[]> {
    const res = await this.pb.collection(this.col.approvalLogs).getFullList({
      filter: this.eq('submission_id', submissionId),
      sort: 'created_at',
    });
    return res.map((d) => this.mapLog(d));
  }

  // --- Surat ---

  async getSuratBySubmissionId(submissionId: string): Promise<SuratDto | null> {
    try {
      const res = await this.pb.collection(this.col.surat).getList(1, 1, {
        filter: this.eq('submission_id', submissionId),
      });
      if (res.items.length === 0) return null;
      return this.mapSurat(res.items[0]);
    } catch {
      return null;
    }
  }

  async upsertSurat(
    submissionId: string,
    data: Partial<Omit<SuratDto, 'id' | 'submissionId'>>
  ): Promise<SuratDto> {
    const existing = await this.getSuratBySubmissionId(submissionId);

    const payload: Record<string, any> = { submission_id: submissionId };
    if (data.nomorSurat !== undefined) payload.nomor_surat = data.nomorSurat;
    if (data.urutan !== undefined) payload.urutan = toInt(data.urutan, 1);
    if (data.noDokumen !== undefined) payload.no_dokumen = data.noDokumen;
    if (data.templateSkId !== undefined) payload.template_sk_id = data.templateSkId || '';
    const scannedSkId = data.scannedSkId ?? data.fileId;
    if (scannedSkId !== undefined) payload.scanned_sk_id = scannedSkId || '';
    if (data.tanggalTerbit !== undefined) payload.created_at = data.tanggalTerbit;
    if (data.createdAt !== undefined) payload.created_at = data.createdAt;

    if (existing) {
      if (payload.nomor_surat === undefined && !existing.nomorSurat) {
        payload.nomor_surat = '';
      }
      const doc = await this.pb.collection(this.col.surat).update(existing.id, payload);
      return this.mapSurat(doc);
    } else {
      if (payload.nomor_surat === undefined) payload.nomor_surat = data.nomorSurat || '';
      if (payload.urutan === undefined) payload.urutan = toInt(data.urutan, 1);
      if (payload.no_dokumen === undefined) {
        payload.no_dokumen = data.noDokumen || `SPSM-${String(submissionId).slice(-8).toUpperCase()}`;
      }
      if (payload.created_at === undefined) payload.created_at = new Date().toISOString();
      const doc = await this.pb.collection(this.col.surat).create(payload);
      return this.mapSurat(doc);
    }
  }

  async getNextSuratUrutan(_prodiCode?: string, _angkatan?: string, _tahun?: number): Promise<number> {
    try {
      const res = await this.pb.collection(this.col.surat).getList(1, 1, { sort: '-urutan' });
      if (res.items.length > 0) {
        return toInt((res.items[0] as any).urutan, 0) + 1;
      }
    } catch (e) {
      console.warn('Error fetching last urutan, fallback to 1:', e);
    }
    return 1;
  }

  // --- Users ---

  async getUserProfileById(id: string): Promise<UserProfileDto | null> {
    try {
      const doc = await this.pb.collection(this.col.users).getOne(id);
      return this.mapUser(doc);
    } catch {
      return null;
    }
  }

  async getUserProfileByUserId(userId: string): Promise<UserProfileDto | null> {
    try {
      const res = await this.pb.collection(this.col.users).getList(1, 1, {
        filter: this.eq('user_id', userId),
      });
      if (res.items.length === 0) return null;
      return this.mapUser(res.items[0]);
    } catch {
      return null;
    }
  }

  async getUserProfileByEmail(email: string): Promise<UserProfileDto | null> {
    try {
      const res = await this.pb.collection(this.col.users).getList(1, 1, {
        filter: this.eq('email', email.toLowerCase().trim()),
      });
      if (res.items.length === 0) return null;
      return this.mapUser(res.items[0]);
    } catch {
      return null;
    }
  }

  async createUserProfile(data: Omit<UserProfileDto, 'id'>): Promise<UserProfileDto> {
    const nimOrNip = (data.nimOrNip || data.nim || '').toString();
    const doc = await this.pb.collection(this.col.users).create({
      user_id: data.userId,
      name: data.name || '',
      email: (data.email || '').toLowerCase().trim(),
      role: data.role || 'student',
      nim_or_nip: nimOrNip,
      department: data.department || '',
      batch_year: toInt(data.batchYear, 0),
      current_sks: toInt(data.currentSks, 0),
      academic_requirements: data.academicRequirements || '',
      avatar_url: data.avatarUrl || '',
      phone: data.phone || '',
      has_uploaded_thesis: Boolean(data.thesisUploaded ?? data.hasUploadedThesis),
      appwrite_id: '',
      external_id: '',
    });
    return this.mapUser(doc);
  }

  async updateUserProfile(id: string, patch: Partial<UserProfileDto>): Promise<UserProfileDto> {
    const payload: Record<string, any> = {};
    if (patch.userId !== undefined) payload.user_id = patch.userId || '';
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.email !== undefined) payload.email = String(patch.email).toLowerCase().trim();
    const nimOrNip = patch.nimOrNip ?? patch.nim;
    if (nimOrNip !== undefined) payload.nim_or_nip = String(nimOrNip);
    if (patch.department !== undefined) payload.department = patch.department;
    if (patch.batchYear !== undefined) payload.batch_year = toInt(patch.batchYear, 0);
    if (patch.currentSks !== undefined) payload.current_sks = toInt(patch.currentSks, 0);
    if (patch.academicRequirements !== undefined) payload.academic_requirements = patch.academicRequirements;
    if (patch.avatarUrl !== undefined) payload.avatar_url = patch.avatarUrl || '';
    if ((patch as any).pushToken !== undefined) payload.push_token = (patch as any).pushToken || '';
    if (patch.phone !== undefined) payload.phone = String(patch.phone).trim();
    const thesisFlag = patch.thesisUploaded ?? patch.hasUploadedThesis ?? (patch as any).has_uploaded_thesis;
    if (thesisFlag !== undefined) payload.has_uploaded_thesis = Boolean(thesisFlag);
    if (patch.role !== undefined) payload.role = patch.role;

    const doc = await this.pb.collection(this.col.users).update(id, payload);
    return this.mapUser(doc);
  }

  async listUsers(limit = 500): Promise<UserProfileDto[]> {
    const res = await this.pb.collection(this.col.users).getList(1, Math.min(Math.max(limit, 1), 1000), {
      sort: '-created',
    });
    return res.items.map((d) => this.mapUser(d));
  }

  // --- Lecturers ---

  async listLecturers(filter?: { activeOnly?: boolean; department?: string }): Promise<LecturerDto[]> {
    const conds: string[] = [];
    if (filter?.activeOnly) conds.push(this.eq('is_active', true));
    if (filter?.department) conds.push(this.eq('department_id', filter.department));
    const res = await this.pb.collection(this.col.lecturers).getFullList({
      filter: conds.length ? conds.join(' && ') : undefined,
    });
    return res.map((d) => this.mapLecturer(d));
  }

  async getLecturerById(id: string): Promise<LecturerDto | null> {
    try {
      const doc = await this.pb.collection(this.col.lecturers).getOne(id);
      return this.mapLecturer(doc);
    } catch {
      return null;
    }
  }

  async getLecturerByEmail(email: string): Promise<LecturerDto | null> {
    try {
      const res = await this.pb.collection(this.col.lecturers).getList(1, 1, {
        filter: this.eq('email', email.toLowerCase().trim()),
      });
      if (res.items.length === 0) return null;
      return this.mapLecturer(res.items[0]);
    } catch {
      return null;
    }
  }

  async getLecturerByNip(nip: string): Promise<LecturerDto | null> {
    try {
      const res = await this.pb.collection(this.col.lecturers).getList(1, 1, {
        filter: this.eq('nip', nip.trim()),
      });
      if (res.items.length === 0) return null;
      return this.mapLecturer(res.items[0]);
    } catch {
      return null;
    }
  }

  async createLecturer(data: Omit<LecturerDto, 'id'>): Promise<LecturerDto> {
    const quota = toInt(data.quota ?? data.maxAdviseeQuota, 10);
    const currentStudents = toInt(data.currentStudents ?? data.currentAdviseeCount, 0);
    const doc = await this.pb.collection(this.col.lecturers).create({
      user_id: data.userId || '',
      nip: data.nip,
      name: data.name,
      email: (data.email || '').toLowerCase().trim(),
      department_id: data.departmentId || data.department || '',
      expertise: data.expertise || '',
      quota,
      current_students: currentStudents,
      role: data.role || 'lecturer',
      is_active: data.isActive ?? true,
    });
    return this.mapLecturer(doc);
  }

  async updateLecturer(id: string, patch: Partial<LecturerDto>): Promise<LecturerDto> {
    const payload: Record<string, any> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.nip !== undefined) payload.nip = patch.nip;
    if (patch.email !== undefined) payload.email = patch.email.toLowerCase().trim();
    if (patch.userId !== undefined) payload.user_id = patch.userId || '';
    const dept = patch.departmentId ?? patch.department;
    if (dept !== undefined) payload.department_id = dept || '';
    if (patch.expertise !== undefined) payload.expertise = patch.expertise;
    const quota = patch.quota ?? patch.maxAdviseeQuota;
    if (quota !== undefined) payload.quota = toInt(quota, 10);
    const currentStudents = patch.currentStudents ?? patch.currentAdviseeCount;
    if (currentStudents !== undefined) payload.current_students = toInt(currentStudents, 0);
    if (patch.role !== undefined) payload.role = patch.role;
    if (patch.isActive !== undefined) payload.is_active = patch.isActive;
    if (patch.rejectedAssignments !== undefined) payload.rejected_assignments = toInt(patch.rejectedAssignments, 0);
    if (patch.rejectionHistory !== undefined) payload.rejection_history = patch.rejectionHistory;

    const doc = await this.pb.collection(this.col.lecturers).update(id, payload);
    return this.mapLecturer(doc);
  }

  async deleteLecturer(id: string): Promise<boolean> {
    await this.pb.collection(this.col.lecturers).delete(id);
    return true;
  }

  // --- Departments & Batch Years ---

  async listDepartments(): Promise<DepartmentDto[]> {
    const res = await this.pb.collection(this.col.departments).getFullList();
    return res
      .filter((d: any) => d.code && !String(d.name || '').trim().startsWith('{'))
      .map((d) => this.mapDepartment(d));
  }

  async createDepartment(data: Omit<DepartmentDto, 'id'>): Promise<DepartmentDto> {
    const doc = await this.pb.collection(this.col.departments).create({
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
    const doc = await this.pb.collection(this.col.departments).update(id, payload);
    return this.mapDepartment(doc);
  }

  async deleteDepartment(id: string): Promise<boolean> {
    await this.pb.collection(this.col.departments).delete(id);
    return true;
  }

  async listBatchYears(): Promise<BatchYearDto[]> {
    const res = await this.pb.collection(this.col.batchYears).getFullList();
    return res.map((d) => this.mapBatchYear(d));
  }

  async createBatchYear(data: Omit<BatchYearDto, 'id'>): Promise<BatchYearDto> {
    const doc = await this.pb.collection(this.col.batchYears).create({
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
    const doc = await this.pb.collection(this.col.batchYears).update(id, payload);
    return this.mapBatchYear(doc);
  }

  async deleteBatchYear(id: string): Promise<boolean> {
    await this.pb.collection(this.col.batchYears).delete(id);
    return true;
  }

  // --- System Settings ---

  private mapSettingsDoc(d: any): SystemSettingsDto {
    const isActive = d.is_active ?? true;
    const requiredTitleCount = toInt(d.required_title_count, 3);
    return {
      id: d.id,
      academicYear: d.academic_year || '2025/2026 Ganjil',
      submissionOpen: isActive,
      isActive,
      startDate: d.start_date || '',
      endDate: d.end_date || '',
      minSks: typeof d.min_sks === 'number' ? d.min_sks : toInt(d.min_sks, 100),
      requiredTitleCount,
      requiredCourses: Array.isArray(d.required_courses) ? d.required_courses : [],
      maxOptions: requiredTitleCount,
      defaultAdvisorQuota: 10,
    };
  }

  async getSystemSettings(): Promise<SystemSettingsDto> {
    try {
      const res = await this.pb.collection(this.col.systemSettings).getList(1, 1);
      if (res.items.length === 0) {
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
      return this.mapSettingsDoc(res.items[0]);
    } catch {
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
    if (patch.requiredTitleCount !== undefined) payload.required_title_count = toInt(patch.requiredTitleCount, 3);
    if (patch.maxOptions !== undefined) payload.required_title_count = toInt(patch.maxOptions, 3);
    if (patch.requiredCourses !== undefined) payload.required_courses = patch.requiredCourses;

    let doc: any;
    if (current.id && current.id !== 'default') {
      doc = await this.pb.collection(this.col.systemSettings).update(current.id, payload);
    } else {
      doc = await this.pb.collection(this.col.systemSettings).create({
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

  /** Kept for interface compatibility — PB realtime replaces the poller. */
  async listRecentDocuments(collectionId: string, limit = 50): Promise<any[]> {
    const map: Record<string, string> = {
      thesis_submissions: this.col.submissions,
      submission_options: this.col.options,
      approval_logs: this.col.approvalLogs,
      surat: this.col.surat,
      system_settings: this.col.systemSettings,
      users: this.col.users,
      lecturers: this.col.lecturers,
      departments: this.col.departments,
      batch_years: this.col.batchYears,
    };
    const name = map[collectionId] || collectionId;
    const res = await this.pb.collection(name).getList(1, Math.min(Math.max(limit, 1), 200), {
      sort: '-updated',
    });
    return res.items;
  }

  /** Expose the underlying PocketBase client for realtime subscriptions & auth helpers. */
  get client(): PocketBase {
    return this.pb;
  }

  // --- Mappers (DTO Boundary) — id/created/updated instead of $id/$createdAt/$updatedAt ---

  private mapSubmission(doc: any): SubmissionDto {
    return {
      id: doc.id,
      studentId: doc.student_id,
      advisor1Id: doc.advisor_1_id || null,
      advisor2Id: doc.advisor_2_id || null,
      preferredAdvisor1Id: doc.preferred_advisor_1_id || null,
      preferredAdvisor2Id: doc.preferred_advisor_2_id || null,
      status: (normalizeSubmissionStatus(doc.status) || 'pending_lecturer') as SubmissionStatus,
      submittedAt: doc.submitted_at || doc.created,
      updatedAt: doc.updated,
      reviewerNotes: doc.reviewer_notes || '',
      kaprodiNotes: doc.kaprodi_notes || '',
    };
  }

  private mapOption(doc: any): SubmissionOptionDto {
    const isSelectedByLecturer =
      doc.is_selected_by_lecturer !== undefined && doc.is_selected_by_lecturer !== null && doc.is_selected_by_lecturer !== ''
        ? Boolean(doc.is_selected_by_lecturer)
        : Boolean(doc.is_selected);
    return {
      id: doc.id,
      submissionId: doc.submission_id,
      optionNumber: toInt(doc.option_number, 0),
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
      isSelected: Boolean(doc.is_selected),
      isSelectedByLecturer,
      reviewNotes: doc.lecturer_notes || doc.review_notes || '',
    };
  }

  private mapLog(doc: any): ApprovalLogDto {
    return {
      id: doc.id,
      submissionId: doc.submission_id,
      actorId: doc.actor_id,
      action: doc.action,
      notes: doc.notes,
      createdAt: doc.created_at || doc.created,
    };
  }

  private mapSurat(doc: any): SuratDto {
    const scannedSkId = doc.scanned_sk_id || null;
    return {
      id: doc.id,
      submissionId: doc.submission_id,
      nomorSurat: doc.nomor_surat || '',
      urutan: toInt(doc.urutan, 0),
      noDokumen: doc.no_dokumen || undefined,
      templateSkId: doc.template_sk_id || null,
      scannedSkId,
      createdAt: doc.created_at || doc.created,
      tanggalTerbit: doc.created_at || doc.created,
      fileId: scannedSkId,
    };
  }

  private mapUser(doc: any): UserProfileDto {
    const thesisUploaded = Boolean(doc.has_uploaded_thesis ?? doc.thesis_uploaded);
    const nimOrNip = doc.nim_or_nip || doc.nim || '';
    return {
      id: doc.id,
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
      createdAt: doc.created || undefined,
    };
  }

  private mapLecturer(doc: any): LecturerDto {
    const quota = toInt(doc.quota, 10);
    const currentStudents = toInt(doc.current_students, 0);
    return {
      id: doc.id,
      userId: doc.user_id || undefined,
      name: doc.name,
      nip: doc.nip,
      email: doc.email,
      phone: doc.phone,
      departmentId: doc.department_id || undefined,
      department: doc.department_id || undefined,
      expertise: doc.expertise || undefined,
      quota,
      currentStudents,
      role: doc.role || 'lecturer',
      isActive: doc.is_active ?? true,
      rejectedAssignments: toInt(doc.rejected_assignments, 0),
      rejectionHistory: Array.isArray(doc.rejection_history) ? doc.rejection_history : [],
      currentAdviseeCount: currentStudents,
      maxAdviseeQuota: quota,
    };
  }

  private mapDepartment(doc: any): DepartmentDto {
    return {
      id: doc.id,
      name: doc.name,
      code: doc.code,
      faculty: doc.faculty || undefined,
      isActive: doc.is_active ?? true,
    };
  }

  private mapBatchYear(doc: any): BatchYearDto {
    return {
      id: doc.id,
      year: doc.year,
      label: doc.label || undefined,
      isActive: doc.is_active ?? true,
    };
  }
}
