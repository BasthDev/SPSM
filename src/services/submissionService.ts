import { apiClient } from './apiClient';
import {
  type ThesisSubmission,
  type SubmissionOption,
  type OptionFormData,
  type LecturerItem,
  type ApprovalLog,
  type SuratItem,
} from '@/models/types';

/**
 * Helper to extract 2-letter prodi code for Nomor Surat
 */
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

/**
 * Helper to extract 2-digit angkatan for Nomor Surat
 */
export function extractAngkatan(batchYear?: number | string): string {
  if (!batchYear) return '23';
  const str = String(batchYear).trim();
  return str.length >= 2 ? str.slice(-2) : str.padStart(2, '0');
}

/**
 * Helper to format official Nomor Surat: URUTAN/SPSM/PRODI/ANGKATAN/TAHUN
 */
export function formatNomorSurat(
  urutanNum: number,
  prodiCode: string,
  angkatan: string,
  year: number = new Date().getFullYear()
): { nomor_surat: string; urutan: string } {
  const urutan = String(urutanNum).padStart(2, '0');
  const nomor_surat = `${urutan}/SPSM/${prodiCode}/${angkatan}/${year}`;
  return { nomor_surat, urutan };
}

function safeJsonParse(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Parse 'Judul N: ...' revision notes from approval log notes into per-option notes */
function parseRevisionNotes(logs: any[] | undefined): Record<number, string> {
  const result: Record<number, string> = {};
  if (!logs) return result;
  for (const log of logs) {
    if (
      log?.action !== 'MINTA_REVISI' &&
      log?.action !== 'REVISI_PENGAJUAN' &&
      log?.action !== 'DITOLAK'
    ) {
      continue;
    }
    const notes = typeof log.notes === 'string' ? log.notes : '';
    const re = /Judul\s*(\d+)\s*:\s*([^\n]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(notes)) !== null) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num) && m[2]?.trim()) {
        result[num] = (result[num] ? result[num] + '\n' : '') + m[2].trim();
      }
    }
  }
  return result;
}

function mapSubmissionDtoToThesis(sub: any): ThesisSubmission {
  if (!sub) return null as any;

  const options: SubmissionOption[] = (sub.options || []).map(mapOptionDtoToModel);
  const revisionNotes = parseRevisionNotes(sub.logs);
  options.forEach((opt) => {
    const note = revisionNotes[opt.option_number];
    if (note && !opt.revision_note) {
      opt.revision_note = note;
    }
  });

  const selectedOption =
    options.find((o) => o.is_selected || o.is_selected_by_lecturer) || null;

  const surat = sub.surat ? mapSuratDtoToItem(sub.surat) : undefined;

  // Kaprodi approval info from DISAHKAN_KAPRODI log (notes JSON)
  const kaprodiLog = (sub.logs || []).find(
    (l: any) => l?.action === 'DISAHKAN_KAPRODI' || l?.action === 'PENGESAHAN_KAPRODI'
  );
  const kaprodiNotesParsed = safeJsonParse(kaprodiLog?.notes);

  const advisor1 = sub.advisor1 ? mapLecturerDtoToItem(sub.advisor1) : undefined;
  const advisor2 = sub.advisor2 ? mapLecturerDtoToItem(sub.advisor2) : undefined;

  return {
    $id: sub.id,
    student_id: sub.studentId,
    advisor_id: sub.advisor1Id || undefined,
    advisor_1_id: sub.advisor1Id || undefined,
    advisor_2_id: sub.advisor2Id || undefined,
    preferred_advisor_1_id: sub.preferredAdvisor1Id || undefined,
    preferred_advisor_2_id: sub.preferredAdvisor2Id || undefined,
    status: sub.status,
    submitted_at: sub.submittedAt,
    options,
    advisor: advisor1,
    advisor2,
    advisor1,
    preferredAdvisor1: sub.preferredAdvisor1
      ? mapLecturerDtoToItem(sub.preferredAdvisor1)
      : undefined,
    preferredAdvisor2: sub.preferredAdvisor2
      ? mapLecturerDtoToItem(sub.preferredAdvisor2)
      : undefined,
    surat,
    logs: sub.logs?.map(mapLogDtoToModel),
    student: sub.student,
    selectedOption,
    nomor_surat: surat?.nomor_surat || sub.nomorSurat || null,
    urutan_surat: surat?.urutan != null ? String(surat.urutan) : null,
    sk_generated_at: surat?.created_at || kaprodiNotesParsed?.generated_at || null,
    kaprodiApprovalDate:
      surat?.created_at || kaprodiLog?.createdAt || kaprodiLog?.created_at || null,
    kaprodiName: kaprodiLog?.actorName || kaprodiLog?.actor_name || null,
    kaprodiNotes: kaprodiNotesParsed?.text || (typeof kaprodiLog?.notes === 'string' && !kaprodiLog.notes.startsWith('{') ? kaprodiLog.notes : null) || sub.kaprodiNotes || null,
    reviewerNotes: sub.reviewerNotes || null,
  } as unknown as ThesisSubmission;
}

function mapOptionDtoToModel(opt: any): SubmissionOption {
  return {
    $id: opt.id,
    submission_id: opt.submissionId,
    option_number: opt.optionNumber,
    title: opt.title,
    background: opt.background,
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
    review_notes: opt.reviewNotes,
    lecturer_notes: opt.reviewNotes,
    revision_note: opt.revisionNote || undefined,
  } as unknown as SubmissionOption;
}

function mapLecturerDtoToItem(lec: any): LecturerItem {
  const id = lec.id || lec.$id;
  return {
    $id: id,
    id,
    user_id: lec.userId,
    userId: lec.userId,
    nip: lec.nip,
    name: lec.name,
    email: lec.email,
    phone: lec.phone,
    department: lec.departmentId || lec.department,
    department_id: lec.departmentId || lec.department,
    departmentId: lec.departmentId || lec.department,
    expertise: lec.expertise,
    quota: lec.quota,
    current_students: lec.currentStudents ?? lec.current_students,
    currentStudents: lec.currentStudents ?? lec.current_students,
    role: lec.role,
    is_active: lec.isActive ?? lec.is_active,
    isActive: lec.isActive ?? lec.is_active,
  } as unknown as LecturerItem;
}

function mapSuratDtoToItem(surat: any): SuratItem {
  return {
    $id: surat.id,
    submission_id: surat.submissionId,
    nomor_surat: surat.nomorSurat,
    nomorSurat: surat.nomorSurat,
    urutan: surat.urutan,
    no_dokumen: surat.noDokumen,
    noDokumen: surat.noDokumen,
    template_sk_id: surat.templateSkId,
    templateSkId: surat.templateSkId,
    scanned_sk_id: surat.scannedSkId,
    scannedSkId: surat.scannedSkId,
    created_at: surat.createdAt,
    createdAt: surat.createdAt,
  } as unknown as SuratItem;
}

function mapLogDtoToModel(log: any): ApprovalLog {
  return {
    $id: log.id,
    submission_id: log.submissionId,
    actor_id: log.actorId,
    action: log.action,
    notes: log.notes,
    created_at: log.createdAt,
  } as unknown as ApprovalLog;
}

export const submissionService = {
  /**
   * Create a new thesis submission with dynamic N title options
   * and student's candidate advisors via Universal API Server.
   * Server validates title duplicate / Gemini AI similarity automatically!
   */
  async createSubmission(
    studentId: string,
    optionsData: OptionFormData[],
    preferredAdvisor1Id?: string,
    preferredAdvisor2Id?: string
  ): Promise<ThesisSubmission> {
    try {
      // 1. Upload any PDF journals via Universal Storage API
      const preparedOptions = [];
      for (const opt of optionsData) {
        let fileId = (opt as any).journalFileId || null;
        if (opt.pdfFile) {
          try {
            const uploaded = await apiClient.files.upload(
              'journals',
              opt.pdfFile,
              `journal_${Date.now()}.pdf`,
              'application/pdf'
            );
            fileId = uploaded.fileId;
          } catch (uploadErr) {
            console.warn('PDF upload warning:', uploadErr);
          }
        }

        preparedOptions.push({
          number: opt.number,
          title: opt.title,
          background: opt.background || '',
          relevanceVariable: opt.relevanceVariable || '',
          relevanceMethodology: opt.relevanceMethodology || '',
          relevanceNote: opt.relevanceNote || '',
          journalTitle: opt.journalTitle || '',
          journalAuthor: opt.journalAuthor || '',
          journalYear: opt.journalYear || '',
          journalFileId: fileId,
        });
      }

      // 2. Call Universal API Server
      const result = await apiClient.submissions.create({
        studentId,
        options: preparedOptions,
        preferredAdvisor1Id: preferredAdvisor1Id || null,
        preferredAdvisor2Id: preferredAdvisor2Id || null,
      });

      return mapSubmissionDtoToThesis(result);
    } catch (error: any) {
      throw new Error(error.message || 'Gagal mengirim pengajuan skripsi');
    }
  },

  /**
   * Resubmit a revision when status is 'revision' or 'rejected'.
   */
  async resubmitRevision(
    submissionId: string,
    studentId: string,
    optionsData: OptionFormData[]
  ): Promise<void> {
    try {
      const preparedOptions = [];
      for (const opt of optionsData) {
        let fileId = (opt as any).journalFileId || null;
        if (opt.pdfFile) {
          try {
            const uploaded = await apiClient.files.upload(
              'journals',
              opt.pdfFile,
              `journal_${Date.now()}.pdf`,
              'application/pdf'
            );
            fileId = uploaded.fileId;
          } catch (uploadErr) {
            console.warn('PDF upload warning:', uploadErr);
          }
        }

        preparedOptions.push({
          number: opt.number,
          title: opt.title,
          background: opt.background || '',
          relevanceVariable: opt.relevanceVariable || '',
          relevanceMethodology: opt.relevanceMethodology || '',
          relevanceNote: opt.relevanceNote || '',
          journalTitle: opt.journalTitle || '',
          journalAuthor: opt.journalAuthor || '',
          journalYear: opt.journalYear || '',
          journalFileId: fileId,
        });
      }

      await apiClient.submissions.resubmitRevision(submissionId, {
        studentId,
        options: preparedOptions,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Gagal mengirim revisi pengajuan');
    }
  },

  async getStudentSubmissions(studentId: string): Promise<ThesisSubmission[]> {
    try {
      const list = await apiClient.submissions.list({ studentId });
      return list.map(mapSubmissionDtoToThesis);
    } catch (error) {
      console.error('Error in getStudentSubmissions:', error);
      return [];
    }
  },

  async getStudentSubmissionsWithDetails(studentId: string): Promise<ThesisSubmission[]> {
    const subs = await this.getStudentSubmissions(studentId);
    return this.hydrateSubmissions(subs);
  },

  async getSubmission(submissionId: string): Promise<ThesisSubmission> {
    const sub = await apiClient.submissions.getById(submissionId);
    if (!sub) throw new Error('Pengajuan tidak ditemukan');
    return mapSubmissionDtoToThesis(sub);
  },

  async getSubmissionWithDetails(submissionId: string): Promise<ThesisSubmission | null> {
    try {
      const sub = await this.getSubmission(submissionId);
      if (!sub) return null;
      const hydrated = await this.hydrateSubmissions([sub]);
      return hydrated[0] || sub;
    } catch {
      return null;
    }
  },

  async getSubmissionOptions(submissionId: string): Promise<SubmissionOption[]> {
    try {
      const sub = await apiClient.submissions.getById(submissionId);
      return (sub?.options || []).map(mapOptionDtoToModel);
    } catch {
      return [];
    }
  },

  async getLecturer(advisorId: string): Promise<LecturerItem | null> {
    if (!advisorId) return null;
    try {
      const lec = await apiClient.lecturers.getById(advisorId);
      return lec ? mapLecturerDtoToItem(lec) : null;
    } catch {
      return null;
    }
  },

  async getLecturers(): Promise<LecturerItem[]> {
    try {
      const list = await apiClient.lecturers.list({ activeOnly: true });
      return list.map(mapLecturerDtoToItem);
    } catch {
      return [];
    }
  },

  async getSubmissionSurat(submissionId: string): Promise<SuratItem | null> {
    try {
      const surat = await apiClient.surat.getBySubmissionId(submissionId);
      return surat ? mapSuratDtoToItem(surat) : null;
    } catch {
      return null;
    }
  },

  async getApprovalLogs(submissionId: string): Promise<ApprovalLog[]> {
    try {
      const sub = await apiClient.submissions.getById(submissionId);
      return (sub?.logs || []).map(mapLogDtoToModel);
    } catch {
      return [];
    }
  },

  async hydrateSubmissions(submissions: ThesisSubmission[]): Promise<ThesisSubmission[]> {
    return submissions.map((sub: any) => {
      if (sub.options && !sub.title) {
        const selected = sub.options.find((o: any) => o.is_selected) || sub.options[0];
        if (selected) {
          sub.title = selected.title;
          sub.background = selected.background;
        }
      }
      return sub;
    });
  },

  async getFileViewUrl(fileId: string): Promise<string> {
    if (!fileId) return '';
    return apiClient.files.getViewUrl('journals', fileId);
  },

  async getFileDownloadUrl(fileId: string): Promise<string> {
    if (!fileId) return '';
    return apiClient.files.getDownloadUrl('journals', fileId);
  },

  async getFileViewUrlForBucket(bucket: 'journals' | 'sk', fileId: string): Promise<string> {
    if (!fileId) return '';
    return apiClient.files.getViewUrl(bucket, fileId);
  },

  async getComparableTitles(): Promise<{ title: string }[]> {
    try {
      const titles = await apiClient.submissions.getComparableTitles();
      return (titles || []).map((t: any) => ({ title: String(t) }));
    } catch {
      return [];
    }
  },
};
