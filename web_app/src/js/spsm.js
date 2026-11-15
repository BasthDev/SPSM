import { apiClient, setAuthToken } from './apiClient.js';

const PRODI_CODE_MAP = {
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

export function extractProdiCode(dept) {
  if (!dept) return 'UNM';
  const clean = dept.trim().toUpperCase();
  if (PRODI_CODE_MAP[clean]) return PRODI_CODE_MAP[clean];
  if (clean.length <= 4) return clean;
  return clean.split(' ').map((w) => w[0]).join('').slice(0, 4) || 'UNM';
}

export function extractAngkatan(batchYear) {
  if (!batchYear) return '23';
  const str = String(batchYear).trim();
  return str.length >= 2 ? str.slice(-2) : str.padStart(2, '0');
}

export function formatNomorSurat(urutanNum, prodiCode, angkatan, year = new Date().getFullYear()) {
  const urutan = String(urutanNum).padStart(2, '0');
  const nomor_surat = `${urutan}/SPSM/${prodiCode}/${angkatan}/${year}`;
  return { nomor_surat, urutan };
}

// Normalisasi status legacy → kanonik (server sudah menormalisasi, ini pengaman UI)
export function statusNorm(status) {
  if (status === 'approved') return 'sk_issued';
  if (status === 'approved_lecturer' || status === 'pending_kaprodi') return 'waiting_kaprodi';
  return status || '';
}

// Status yang dianggap "SK sudah disahkan/terbit"
export const APPROVED_STATUSES = new Set(['sk_issued', 'approved']);

export function formatDateShort(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export const authService = {
  async loginWithGoogle() {
    const { url, key } = await apiClient.auth.oauthStart();
    if (!url || !key) throw new Error('Gagal memulai login Google.');

    const popup = window.open(url, 'spsm_oauth', 'width=520,height=680');
    if (!popup) throw new Error('Popup diblokir browser. Izinkan popup untuk login.');

    const deadline = Date.now() + 3 * 60 * 1000;
    while (Date.now() < deadline) {
      if (popup.closed) {
        await new Promise((r) => setTimeout(r, 800));
        const last = await apiClient.auth.oauthStatus(key).catch(() => null);
        if (last?.status === 'done' && last?.token) {
          setAuthToken(last.token);
          window.location.href = 'index.html';
          return last.user;
        }
        throw new Error('Login dibatalkan.');
      }

      const status = await apiClient.auth.oauthStatus(key).catch(() => null);
      if (status?.status === 'done' && status?.token) {
        try { popup.close(); } catch {}
        setAuthToken(status.token);
        window.location.href = 'index.html';
        return status.user;
      }
      if (status?.status === 'error') {
        try { popup.close(); } catch {}
        throw new Error(status.error || 'Autentikasi Google gagal.');
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    try { popup.close(); } catch {}
    throw new Error('Login kedaluwarsa. Silakan coba lagi.');
  },

  async loginWithEmail(email, pass) {
    return await apiClient.auth.login(email.trim(), pass);
  },

  async logout() {
    try {
      await apiClient.auth.logout();
    } catch (e) {
      console.warn('Logout error', e);
    }
    const path = window.location.pathname.replace(/\/[^/]*$/, '/');
    window.location.href = path + 'signin.html';
  },

  async getCurrentUser() {
    try {
      const u = await apiClient.auth.getCurrentUser();
      if (!u) return null;

      const isAdmin = Boolean(u.isAdmin || u.role === 'admin' || (u.email || '').toLowerCase() === 'ws.basithachmed@gmail.com');
      return {
        account: { $id: u.userId || u.id, email: u.email, name: u.name },
        profile: u.profile
          ? {
              ...u.profile,
              $id: u.profile.id,
              user_id: u.profile.userId,
              nim_or_nip: u.profile.nimOrNip || u.profile.nim,
              nim: u.profile.nim,
              department: u.profile.department,
              batch_year: u.profile.batchYear,
              has_uploaded_thesis: u.profile.thesisUploaded ?? u.profile.hasUploadedThesis ?? false,
            }
          : null,
        lecturer: u.lecturer
          ? {
              ...u.lecturer,
              $id: u.lecturer.id,
              department_id: u.lecturer.departmentId || u.lecturer.department || '',
              current_students: u.lecturer.currentStudents ?? u.lecturer.currentAdviseeCount ?? 0,
              quota: u.lecturer.quota ?? u.lecturer.maxAdviseeQuota ?? 10,
              is_active: u.lecturer.isActive ?? u.lecturer.is_active ?? true,
            }
          : null,
        role: u.role || (isAdmin ? 'admin' : 'student'),
        isAdmin,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=204B76&color=fff&bold=true`,
      };
    } catch {
      return null;
    }
  },
};

// ============ MEMOIZATION LAYER ============
const _lecCache = new Map();
let _subsCache = new Map();
let _deptNameMap = null;

async function getDeptNameMap() {
  if (_deptNameMap) return _deptNameMap;
  _deptNameMap = new Map();
  try {
    const depts = await masterDataService.getDepartments();
    for (const d of depts || []) {
      const name = d.name;
      if (!name) continue;
      for (const key of [d.code, d.$id, d.id, name]) {
        if (key) _deptNameMap.set(String(key).trim().toLowerCase(), name);
      }
    }
  } catch (e) {
    console.warn('department name map failed:', e);
  }
  return _deptNameMap;
}

export function resolveDeptName(dept, deptMap) {
  if (!dept) return dept || '';
  const raw = String(dept).trim();
  if (!raw) return raw;
  const hit = deptMap?.get(raw.toLowerCase());
  return hit || raw;
}

export const lecturerService = {
  async getLecturers() {
    if (_lecCache.has('all')) return _lecCache.get('all');
    try {
      const apiList = await apiClient.lecturers.list();
      if (Array.isArray(apiList)) {
        const mapped = apiList.map((l) => ({
          ...l,
          $id: l.id,
          department_id: l.departmentId || l.department || '',
          expertise: l.expertise || '',
          role: l.role || 'lecturer',
          current_students: l.currentStudents ?? l.currentAdviseeCount ?? 0,
          quota: l.quota ?? l.maxAdviseeQuota ?? 10,
          is_active: l.isActive ?? l.is_active ?? true,
        }));
        _lecCache.set('all', mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('getLecturers failed:', e);
    }
    return [];
  },

  invalidateLecturerCache() {
    _lecCache.clear();
  },

  async syncStudentCount(lecturerId) {
    this.invalidateLecturerCache();
    if (!lecturerId) return;
    try {
      const allSubs = await apiClient.submissions.list();
      const count = (allSubs || []).filter((sub) => {
        if (!APPROVED_STATUSES.has(statusNorm(sub.status)) && !['waiting_akademik', 'sk_process'].includes(sub.status)) {
          return false;
        }
        const parts = [
          sub.advisor1Id || sub.advisor_1_id,
          sub.advisor2Id || sub.advisor_2_id,
        ].filter(Boolean).map((p) => String(p).trim());
        return parts.includes(lecturerId);
      }).length;

      await apiClient.lecturers.update(lecturerId, {
        currentStudents: count,
        current_students: count,
      });
    } catch (e) {
      console.warn('syncStudentCount failed', e);
    }
  },

  async updateRole(lecturerId, role) {
    this.invalidateLecturerCache();
    return await apiClient.lecturers.update(lecturerId, { role });
  },

  async createLecturer(data) {
    this.invalidateLecturerCache();
    const deptId = data.department_id || data.department || data.departmentId || '';
    const created = await apiClient.lecturers.create({
      name: data.name,
      nip: data.nip,
      email: data.email,
      phone: data.phone || '',
      department_id: deptId,
      departmentId: deptId,
      department: deptId,
      is_active: data.is_active ?? true,
      isActive: data.is_active ?? true,
      current_students: data.current_students || 0,
      currentStudents: data.current_students || 0,
      quota: data.quota || 10,
      role: data.role || 'lecturer',
      expertise: data.expertise || '',
    });
    return { ...created, $id: created.id };
  },

  async updateLecturer(id, data) {
    this.invalidateLecturerCache();
    const deptId = data.department_id || data.department || data.departmentId;
    const updated = await apiClient.lecturers.update(id, {
      name: data.name,
      nip: data.nip,
      email: data.email,
      phone: data.phone,
      department_id: deptId,
      departmentId: deptId,
      department: deptId,
      is_active: data.is_active,
      isActive: data.is_active,
      current_students: data.current_students,
      currentStudents: data.current_students,
      quota: data.quota,
      role: data.role,
      expertise: data.expertise,
    });
    return { ...updated, $id: updated.id };
  },

  async deleteLecturer(id) {
    this.invalidateLecturerCache();
    return await apiClient.lecturers.delete(id);
  },
};

function lecturerDtoToLegacy(l) {
  if (!l) return null;
  return {
    ...l,
    $id: l.id,
    department_id: l.departmentId || l.department || '',
    current_students: l.currentStudents ?? l.currentAdviseeCount ?? 0,
    quota: l.quota ?? l.maxAdviseeQuota ?? 10,
    is_active: l.isActive ?? l.is_active ?? true,
  };
}

// Resolve preferred advisor: utamakan objek LecturerDto hasil hydration,
// fallback lookup by id di daftar dosen.
function resolvePreferredAdvisor(dto, id, lecById) {
  if (dto) return lecturerDtoToLegacy(dto);
  if (!id) return null;
  const found = lecById?.get(id);
  return found ? lecturerDtoToLegacy(found) : { $id: id, name: `Dosen ID: ${id}` };
}

function mapSubmissionDtoToLegacy(sub, lecById, deptMap) {
  if (!sub) return null;
  const surat = sub.surat || null;
  return {
    $id: sub.id,
    id: sub.id,
    student_id: sub.studentId,
    advisor_1_id: sub.advisor1Id,
    advisor_2_id: sub.advisor2Id,
    advisor_id: sub.advisor1Id && sub.advisor2Id ? `${sub.advisor1Id},${sub.advisor2Id}` : (sub.advisor1Id || sub.advisor2Id || null),
    preferred_advisor_1_id: sub.preferredAdvisor1Id || sub.preferredAdvisor1?.id || null,
    preferred_advisor_2_id: sub.preferredAdvisor2Id || sub.preferredAdvisor2?.id || null,
    preferredAdvisor1: resolvePreferredAdvisor(sub.preferredAdvisor1, sub.preferredAdvisor1Id, lecById),
    preferredAdvisor2: resolvePreferredAdvisor(sub.preferredAdvisor2, sub.preferredAdvisor2Id, lecById),
    status: sub.status,
    status_norm: statusNorm(sub.status),
    submitted_at: sub.submittedAt,
    $createdAt: sub.submittedAt,
    $updatedAt: sub.updatedAt,
    reviewer_notes: sub.reviewerNotes || '',
    kaprodi_notes: sub.kaprodiNotes || '',
    nomor_surat: surat?.nomorSurat || null,
    urutan_surat: surat?.urutan ? String(surat.urutan) : null,
    no_dokumen: surat?.noDokumen || null,
    sk_generated_at: surat?.createdAt || null,
    scanned_sk_id: surat?.scannedSkId || null,
    template_sk_id: surat?.templateSkId || null,
    options: (sub.options || []).map((opt) => ({
      ...opt,
      $id: opt.id,
      submission_id: opt.submissionId,
      option_number: opt.optionNumber,
      relevance_table: opt.relevanceTable,
      relevance_variable: opt.relevanceVariable,
      relevance_methodology: opt.relevanceMethodology,
      relevance_note: opt.relevanceNote,
      journal_title: opt.journalTitle,
      journal_author: opt.journalAuthor,
      journal_year: opt.journalYear,
      journal_file_id: opt.journalFileId,
      is_selected: opt.isSelected,
      is_selected_by_lecturer: opt.isSelectedByLecturer ?? opt.isSelected,
      lecturer_notes: opt.reviewNotes,
      review_notes: opt.reviewNotes,
    })),
    student: sub.student
      ? {
          ...sub.student,
          $id: sub.student.id,
          user_id: sub.student.userId,
          nim_or_nip: sub.student.nimOrNip || sub.student.nim,
          nim: sub.student.nim,
          department: resolveDeptName(sub.student.department, deptMap),
          department_code: sub.student.department || '',
          department_name: resolveDeptName(sub.student.department, deptMap),
          batch_year: sub.student.batchYear,
          has_uploaded_thesis: sub.student.thesisUploaded ?? sub.student.hasUploadedThesis ?? false,
          current_sks: sub.student.currentSks,
        }
      : null,
    advisor: lecturerDtoToLegacy(sub.advisor1),
    advisor2: lecturerDtoToLegacy(sub.advisor2),
    surat: surat
      ? {
          ...surat,
          $id: surat.id,
          nomor_surat: surat.nomorSurat,
          urutan_surat: surat.urutan,
          no_dokumen: surat.noDokumen,
          template_sk_id: surat.templateSkId,
          scanned_sk_id: surat.scannedSkId,
          sk_generated_at: surat.createdAt,
          tanggal_terbit: surat.createdAt,
          created_at: surat.createdAt,
        }
      : null,
    logs: (sub.logs || []).map((l) => ({
      ...l,
      $id: l.id,
      submission_id: l.submissionId,
      actor_id: l.actorId,
      actor_name: l.actorName,
      created_at: l.createdAt,
      $createdAt: l.createdAt,
    })),
  };
}

export const submissionService = {
  invalidateSubmissionsCache() {
    _subsCache = new Map();
  },

  getFileViewUrl(fileId, bucket = 'journals') {
    if (!fileId) return '#';
    return apiClient.files.getViewUrl(bucket, fileId);
  },

  async getAllSubmissions(statusFilter, advisorIdFilter) {
    const cacheKey = `${statusFilter || 'all'}|${advisorIdFilter || 'all'}`;
    if (_subsCache.has(cacheKey)) {
      return _subsCache.get(cacheKey);
    }

    try {
      const filter = {};
      if (statusFilter && statusFilter !== 'all') filter.status = statusFilter;
      if (advisorIdFilter && advisorIdFilter !== 'all') filter.advisorId = advisorIdFilter;

      const apiSubs = await apiClient.submissions.list(filter);
      if (Array.isArray(apiSubs)) {
        // Lookup dosen untuk fallback resolusi preferred advisor (bila DTO tidak ter-hydrate)
        let lecById = null;
        const needsLookup = apiSubs.some(
          (s) => (s.preferredAdvisor1Id && !s.preferredAdvisor1) || (s.preferredAdvisor2Id && !s.preferredAdvisor2)
        );
        if (needsLookup) {
          try {
            const lecs = await lecturerService.getLecturers();
            lecById = new Map((lecs || []).map((l) => [l.$id || l.id, l]));
          } catch (e) {
            console.warn('lecturer lookup for preferred advisors failed:', e);
          }
        }
        const deptMap = await getDeptNameMap();
        let submissions = apiSubs.map((s) => mapSubmissionDtoToLegacy(s, lecById, deptMap));
        if (advisorIdFilter && advisorIdFilter !== 'all') {
          submissions = submissions.filter((sub) => {
            const parts = [
              sub.advisor_1_id,
              sub.advisor_2_id,
            ].filter(Boolean).map((s) => s.trim());
            return parts.includes(advisorIdFilter);
          });
        }
        _subsCache.set(cacheKey, submissions);
        return submissions;
      }
    } catch (apiErr) {
      console.warn('apiClient list failed:', apiErr);
    }
    return [];
  },

  getSubmissions(statusFilter, advisorIdFilter) {
    return this.getAllSubmissions(statusFilter, advisorIdFilter);
  },

  async reviewAndSelectTitle(submissionId, selectedOptionId, advisor1Id, advisor2Id, reviewerName, notes) {
    this.invalidateSubmissionsCache();
    const a1 = (advisor1Id || '').trim();
    const a2 = (advisor2Id || '').trim();

    return await apiClient.submissions.updateStatus(
      submissionId,
      'waiting_kaprodi',
      'VERIFIKASI_DOSEN_PENILAI',
      notes || 'Proposal disetujui Dosen Penilai dan diajukan ke Kaprodi.',
      {
        advisor1Id: a1 || null,
        advisor2Id: a2 || null,
        selectedOptionId,
        reviewerNotes: notes || '',
      }
    );
  },

  async ensureSuratGenerated(submissionId) {
    try {
      const existing = await apiClient.surat.getBySubmissionId(submissionId);
      if (existing) return existing;

      const sub = await apiClient.submissions.getById(submissionId);
      const dept = sub?.student?.department || 'TI';
      const batchYear = sub?.student?.batchYear || '2023';

      return await apiClient.surat.generate(submissionId, dept, batchYear);
    } catch (err) {
      console.warn('ensureSuratGenerated warning:', err);
      return null;
    }
  },

  async processDekanSignature(submissionId, staffName) {
    this.invalidateSubmissionsCache();
    return await apiClient.submissions.updateStatus(
      submissionId,
      'sk_process',
      'PROSES_TTD_DEKAN',
      'Draf SK telah dicetak fisik dan sedang dalam proses tanda tangan Dekan.',
      null
    );
  },

  async uploadSignedSk(submissionId, file, staffName) {
    this.invalidateSubmissionsCache();
    const uploaded = await apiClient.files.upload('sk', file);
    const fileId = uploaded.fileId || uploaded.id;

    await apiClient.submissions.updateStatus(
      submissionId,
      'sk_issued',
      'SK_RESMI_TERBIT',
      `Scan PDF SK resmi ber-TTD basah Dekan berhasil diunggah (File ID: ${fileId}). SK resmi diterbitkan.`,
      { scannedSkId: fileId }
    );

    return uploaded;
  },

  async kaprodiApprove(submissionId, advisor1Id, advisor2Id, kaprodiName, notes) {
    this.invalidateSubmissionsCache();
    const a1 = (advisor1Id || '').trim();
    const a2 = (advisor2Id || '').trim();

    const surat = await this.ensureSuratGenerated(submissionId);

    await apiClient.submissions.updateStatus(
      submissionId,
      'waiting_akademik',
      'DISAHKAN_KAPRODI',
      JSON.stringify({
        nomor_surat: surat?.nomorSurat || surat?.nomor_surat,
        urutan: surat?.urutan,
        text: notes || 'Judul dan Dosen Pembimbing resmi disahkan oleh Kaprodi (Tahap Pleno). Menunggu administrasi SK.',
        generated_at: new Date().toISOString(),
      }),
      {
        advisor1Id: a1 || null,
        advisor2Id: a2 || null,
      }
    );

    if (a1) await lecturerService.syncStudentCount(a1);
    if (a2 && a2 !== a1) await lecturerService.syncStudentCount(a2);

    return surat;
  },

  _buildStructuredNotes(kind, notes) {
    if (typeof notes === 'string') return notes;
    if (!notes || typeof notes !== 'object') return '';
    const label = kind === 'revisi' ? 'Catatan Revisi per Judul' : 'Catatan Penolakan per Judul';
    const fallback = kind === 'revisi' ? 'Perlu perbaikan rumusan masalah.' : 'Tidak memenuhi kualifikasi penelitian.';
    let text = `${label}:\n`;
    text += `Judul 1: ${notes.opt1 || fallback}\n`;
    text += `Judul 2: ${notes.opt2 || fallback}\n`;
    text += `Judul 3: ${notes.opt3 || fallback}`;
    if (notes.general) text += `\n\nCatatan Tambahan: ${notes.general}`;
    return text;
  },

  async requestRevision(submissionId, actorName, notes) {
    this.invalidateSubmissionsCache();
    return await apiClient.submissions.updateStatus(
      submissionId,
      'revision',
      'MINTA_REVISI',
      this._buildStructuredNotes('revisi', notes) || 'Proposal memerlukan perbaikan dari mahasiswa.',
      null
    );
  },

  async rejectSubmission(submissionId, actorName, notes, advisorId) {
    this.invalidateSubmissionsCache();
    const res = await apiClient.submissions.updateStatus(
      submissionId,
      'rejected',
      'DITOLAK',
      this._buildStructuredNotes('tolak', notes) || 'Pengajuan judul ditolak.',
      null
    );

    if (advisorId) {
      const parts = advisorId.split(',').map((s) => s.trim()).filter(Boolean);
      for (const adv of parts) {
        await lecturerService.syncStudentCount(adv);
      }
    }

    return res;
  },
};

export const settingsService = {
  async getSettings() {
    const DEFAULTS = {
      is_active: true,
      start_date: '',
      end_date: '',
      academic_year: '2025/2026 Ganjil',
      min_sks: 100,
      required_title_count: 3,
      required_courses: [],
    };
    try {
      const s = await apiClient.settings.get();
      if (s) {
        return {
          is_active: s.submissionOpen !== false,
          start_date: s.startDate || DEFAULTS.start_date,
          end_date: s.endDate || DEFAULTS.end_date,
          academic_year: s.academicYear || DEFAULTS.academic_year,
          min_sks: s.minSks || DEFAULTS.min_sks,
          required_title_count: s.maxOptions || DEFAULTS.required_title_count,
          required_courses: s.requiredCourses || DEFAULTS.required_courses,
        };
      }
    } catch (e) {
      console.warn('getSettings via API failed:', e);
    }
    return DEFAULTS;
  },

  async updateSettings(settings) {
    try {
      await apiClient.settings.update({
        submissionOpen: settings.is_active,
        academicYear: settings.academic_year,
        maxOptions: settings.required_title_count,
        startDate: settings.start_date,
        endDate: settings.end_date,
        minSks: settings.min_sks,
        requiredCourses: settings.required_courses,
      });
    } catch (e) {
      console.warn('updateSettings via API failed:', e);
    }
    return settings;
  },
};

export const repoService = {
  async listAllFiles() {
    try {
      const files = await apiClient.files.list('journals');
      if (Array.isArray(files)) {
        return files
          // File referensi opsi judul (refopt_*) bukan dokumen repository — kecualikan
          .filter((f) => !/^refopt_/i.test((f.name || '').replace(/^owner_[^_]+__/, '')))
          .map((f) => ({
            $id: f.id,
            name: f.name,
            sizeOriginal: f.sizeOriginal ?? f.size,
            $createdAt: f.createdAt,
            mimeType: f.mimeType,
          }));
      }
    } catch (e) {
      console.warn('listAllFiles failed:', e);
    }
    return [];
  },

  getFileViewUrl(fileId, bucket = 'journals') {
    if (!fileId) return '#';
    return apiClient.files.getViewUrl(bucket, fileId);
  },

  getFileDownloadUrl(fileId) {
    if (!fileId) return '#';
    return apiClient.files.getDownloadUrl('journals', fileId);
  },
};

export const masterDataService = {
  async getDepartments() {
    try {
      const list = await apiClient.departments.list();
      if (Array.isArray(list)) {
        return list.map((d) => ({
          ...d,
          $id: d.id,
          is_active: d.isActive,
        }));
      }
    } catch (e) {
      console.warn('getDepartments failed:', e);
    }
    return [];
  },

  async getBatchYears() {
    try {
      const list = await apiClient.batchYears.list();
      if (Array.isArray(list)) {
        return list.map((b) => ({
          ...b,
          $id: b.id,
          is_active: b.isActive,
        }));
      }
    } catch (e) {
      console.warn('getBatchYears failed:', e);
    }
    return [];
  },

  async createDepartment(data) {
    const res = await apiClient.departments.create({
      code: data.code,
      name: data.name,
      faculty: data.faculty || '',
      isActive: data.is_active ?? true,
    });
    return { ...res, $id: res.id };
  },

  async updateDepartment(id, data) {
    const res = await apiClient.departments.update(id, {
      code: data.code,
      name: data.name,
      faculty: data.faculty,
      isActive: data.is_active,
    });
    return { ...res, $id: res.id };
  },

  async deleteDepartment(id) {
    return await apiClient.departments.delete(id);
  },

  async createBatchYear(data) {
    const res = await apiClient.batchYears.create({
      year: parseInt(data.year, 10) || data.year,
      label: data.label || '',
      isActive: data.is_active ?? true,
    });
    return { ...res, $id: res.id };
  },

  async updateBatchYear(id, data) {
    const res = await apiClient.batchYears.update(id, {
      year: parseInt(data.year, 10) || data.year,
      label: data.label,
      isActive: data.is_active,
    });
    return { ...res, $id: res.id };
  },

  async deleteBatchYear(id) {
    return await apiClient.batchYears.delete(id);
  },
};
