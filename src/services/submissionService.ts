import { databases, storage } from './appwrite';
import { ID, Query } from 'appwrite';
import {
  DATABASE_ID,
  COLLECTION_SUBMISSIONS,
  COLLECTION_OPTIONS,
  COLLECTION_APPROVAL_LOGS,
  COLLECTION_LECTURERS,
  BUCKET_JOURNALS,
  type ThesisSubmission,
  type SubmissionOption,
  type OptionFormData,
  type LecturerItem,
  type ApprovalLog,
} from '@/models/types';

/**
 * Helper to parse embedded relevance table data from background text.
 */
function parseOptionRelevance(opt: SubmissionOption): SubmissionOption {
  if (opt.background && opt.background.includes('<!-- RELEVANCE_DATA:')) {
    const match = opt.background.match(/<!-- RELEVANCE_DATA:\s*(\{[\s\S]*?\})\s*-->/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        opt.relevance_variable = parsed.v || '';
        opt.relevance_methodology = parsed.m || '';
        opt.relevance_note = parsed.r || '';
        opt.background = opt.background.replace(/<!-- RELEVANCE_DATA:[\s\S]*?-->/g, '').trim();
      } catch {
        // ignore
      }
    }
  }
  return opt;
}

export const submissionService = {
  /**
   * Create a new thesis submission with up to 3 title options
   * and student's 2 candidate advisors.
   */
  async createSubmission(
    studentId: string,
    optionsData: OptionFormData[],
    preferredAdvisor1Id?: string,
    preferredAdvisor2Id?: string
  ): Promise<ThesisSubmission> {
    try {
      // 1. Create the main submission header
      const submission = await databases.createDocument(
        DATABASE_ID,
        COLLECTION_SUBMISSIONS,
        ID.unique(),
        {
          student_id: studentId,
          status: 'pending_lecturer',
          submitted_at: new Date().toISOString(),
        }
      );

      // 2. Create each title option (encoding relevance table if present)
      for (const option of optionsData) {
        let fileId: string | null = null;

        // Upload PDF journal if provided
        if (option.pdfFile) {
          const uploadedFile = await storage.createFile(
            BUCKET_JOURNALS,
            ID.unique(),
            option.pdfFile
          );
          fileId = uploadedFile.$id;
        }

        let finalBackground = option.background;
        if (option.relevanceVariable || option.relevanceMethodology || option.relevanceNote) {
          const relTag = `\n\n<!-- RELEVANCE_DATA: ${JSON.stringify({
            v: option.relevanceVariable || '',
            m: option.relevanceMethodology || '',
            r: option.relevanceNote || '',
          })} -->`;
          finalBackground = `${option.background.trim()}${relTag}`;
        }

        await databases.createDocument(
          DATABASE_ID,
          COLLECTION_OPTIONS,
          ID.unique(),
          {
            submission_id: submission.$id,
            option_number: option.number,
            title: option.title,
            background: finalBackground,
            journal_title: option.journalTitle ?? '',
            journal_author: option.journalAuthor ?? '',
            journal_file_id: fileId,
            is_selected_by_lecturer: false,
          }
        );
      }

      // 3. Record student's 2 preferred advisors in an initial log
      if (preferredAdvisor1Id || preferredAdvisor2Id) {
        await databases.createDocument(
          DATABASE_ID,
          COLLECTION_APPROVAL_LOGS,
          ID.unique(),
          {
            submission_id: submission.$id,
            actor_id: 'Mahasiswa (Pemohon)',
            action: 'PENGAJUAN_MAHASISWA',
            notes: JSON.stringify({
              pref1: preferredAdvisor1Id || null,
              pref2: preferredAdvisor2Id || null,
            }),
            created_at: new Date().toISOString(),
          }
        );
      }

      return submission as unknown as ThesisSubmission;
    } catch (error: any) {
      throw new Error(`Gagal mengirim pengajuan: ${error.message}`);
    }
  },

  /**
   * Get all submissions for a specific student.
   */
  async getStudentSubmissions(studentId: string): Promise<ThesisSubmission[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_SUBMISSIONS,
        [
          Query.equal('student_id', studentId),
          Query.orderDesc('submitted_at'),
        ]
      );
      return response.documents as unknown as ThesisSubmission[];
    } catch (error: any) {
      throw new Error(`Gagal mengambil daftar pengajuan: ${error.message}`);
    }
  },

  /**
   * Get a single submission by ID.
   */
  async getSubmission(submissionId: string): Promise<ThesisSubmission> {
    try {
      const doc = await databases.getDocument(
        DATABASE_ID,
        COLLECTION_SUBMISSIONS,
        submissionId
      );
      return doc as unknown as ThesisSubmission;
    } catch (error: any) {
      throw new Error(`Gagal mengambil detail pengajuan: ${error.message}`);
    }
  },

  /**
   * Get all options for a given submission.
   */
  async getSubmissionOptions(submissionId: string): Promise<SubmissionOption[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_OPTIONS,
        [
          Query.equal('submission_id', submissionId),
          Query.orderAsc('option_number'),
        ]
      );
      const docs = response.documents as unknown as SubmissionOption[];
      return docs.map(parseOptionRelevance);
    } catch (error: any) {
      throw new Error(`Gagal mengambil opsi judul: ${error.message}`);
    }
  },

  /**
   * Get advisor/lecturer details by ID.
   */
  async getLecturer(advisorId: string): Promise<LecturerItem | null> {
    if (!advisorId) return null;
    try {
      const doc = await databases.getDocument(
        DATABASE_ID,
        COLLECTION_LECTURERS,
        advisorId
      );
      return doc as unknown as LecturerItem;
    } catch {
      return null;
    }
  },

  /**
   * Get approval logs for a submission.
   */
  async getApprovalLogs(submissionId: string): Promise<ApprovalLog[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_APPROVAL_LOGS,
        [
          Query.equal('submission_id', submissionId),
          Query.orderDesc('created_at'),
        ]
      );
      return response.documents as unknown as ApprovalLog[];
    } catch {
      return [];
    }
  },

  /**
   * Get complete submission with hydrated advisors (1 & 2),
   * preferred advisors, options, relevance tables, and per-option notes.
   */
  async getSubmissionWithDetails(submissionId: string): Promise<ThesisSubmission> {
    const sub = await this.getSubmission(submissionId);
    const [options, logs] = await Promise.all([
      this.getSubmissionOptions(submissionId),
      this.getApprovalLogs(submissionId),
    ]);

    sub.options = options;
    sub.logs = logs;
    sub.selectedOption = options.find((o) => o.is_selected_by_lecturer) || null;

    // Hydrate Pembimbing 1 and Pembimbing 2
    if (sub.advisor_id) {
      const parts = sub.advisor_id.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        sub.advisor = await this.getLecturer(parts[0]);
      }
      if (parts.length > 1) {
        sub.advisor2 = await this.getLecturer(parts[1]);
      }
    }

    // Hydrate student's preferred advisors
    const studentLog = logs.find((l) => l.action === 'PENGAJUAN_MAHASISWA');
    if (studentLog && studentLog.notes) {
      try {
        const parsed = JSON.parse(studentLog.notes);
        if (parsed.pref1) sub.preferredAdvisor1 = await this.getLecturer(parsed.pref1);
        if (parsed.pref2) sub.preferredAdvisor2 = await this.getLecturer(parsed.pref2);
      } catch {
        // ignore
      }
    }

    // Find Kaprodi approval log
    const kaprodiLog = logs.find(
      (l) =>
        l.action === 'DISAHKAN_KAPRODI' ||
        l.action === 'kaprodi_approve' ||
        l.action?.toUpperCase().includes('KAPRODI')
    );
    if (kaprodiLog) {
      sub.kaprodiApprovalDate = kaprodiLog.created_at;
      sub.kaprodiName = kaprodiLog.actor_id;
      sub.kaprodiNotes = kaprodiLog.notes;
    }

    // Find Reviewer log
    const reviewerLog = logs.find(
      (l) =>
        l.action === 'VERIFIKASI_DOSEN_PENILAI' ||
        l.action === 'select_title_and_advisor'
    );
    if (reviewerLog) {
      sub.reviewerNotes = reviewerLog.notes;
    }

    // Parse per-title rejection/revision notes if available
    const decisionLog = logs.find(
      (l) => l.action === 'MINTA_REVISI' || l.action === 'DITOLAK'
    );
    if (decisionLog && decisionLog.notes) {
      options.forEach((opt) => {
        const regex = new RegExp(`Judul\\s*#?${opt.option_number}\\s*:\\s*([^\\n]+)`, 'i');
        const m = decisionLog.notes!.match(regex);
        if (m && m[1]) {
          opt.revision_note = m[1].trim();
        }
      });
    }

    return sub;
  },

  /**
   * Get all submissions for a student with detailed options and advisors.
   */
  async getStudentSubmissionsWithDetails(studentId: string): Promise<ThesisSubmission[]> {
    const subs = await this.getStudentSubmissions(studentId);
    return Promise.all(
      subs.map(async (sub) => {
        try {
          const [options, logs] = await Promise.all([
            this.getSubmissionOptions(sub.$id),
            this.getApprovalLogs(sub.$id),
          ]);
          sub.options = options;
          sub.logs = logs;
          sub.selectedOption = options.find((o) => o.is_selected_by_lecturer) || null;

          if (sub.advisor_id) {
            const parts = sub.advisor_id.split(',').map((s) => s.trim()).filter(Boolean);
            if (parts.length > 0) {
              sub.advisor = await this.getLecturer(parts[0]);
            }
            if (parts.length > 1) {
              sub.advisor2 = await this.getLecturer(parts[1]);
            }
          }

          const studentLog = logs.find((l) => l.action === 'PENGAJUAN_MAHASISWA');
          if (studentLog && studentLog.notes) {
            try {
              const parsed = JSON.parse(studentLog.notes);
              if (parsed.pref1) sub.preferredAdvisor1 = await this.getLecturer(parsed.pref1);
              if (parsed.pref2) sub.preferredAdvisor2 = await this.getLecturer(parsed.pref2);
            } catch {
              // ignore
            }
          }

          const kaprodiLog = logs.find(
            (l) =>
              l.action === 'DISAHKAN_KAPRODI' ||
              l.action === 'kaprodi_approve' ||
              l.action?.toUpperCase().includes('KAPRODI')
          );
          if (kaprodiLog) {
            sub.kaprodiApprovalDate = kaprodiLog.created_at;
            sub.kaprodiName = kaprodiLog.actor_id;
            sub.kaprodiNotes = kaprodiLog.notes;
          }

          // Parse per-title rejection/revision notes if available
          const decisionLog = logs.find(
            (l) => l.action === 'MINTA_REVISI' || l.action === 'DITOLAK'
          );
          if (decisionLog && decisionLog.notes) {
            options.forEach((opt) => {
              const regex = new RegExp(`Judul\\s*#?${opt.option_number}\\s*:\\s*([^\\n]+)`, 'i');
              const m = decisionLog.notes!.match(regex);
              if (m && m[1]) {
                opt.revision_note = m[1].trim();
              }
            });
          }
        } catch {
          // ignore
        }
        return sub;
      })
    );
  },

  /**
   * Get public file view URL for journal PDF.
   */
  getFileViewUrl(fileId: string): string {
    if (!fileId) return '';
    try {
      return storage.getFileView(BUCKET_JOURNALS, fileId).toString();
    } catch {
      return '';
    }
  },
};
