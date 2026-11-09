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

export const submissionService = {
  /**
   * Create a new thesis submission with up to 3 title options.
   */
  async createSubmission(
    studentId: string,
    optionsData: OptionFormData[]
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

      // 2. Create each title option
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

        await databases.createDocument(
          DATABASE_ID,
          COLLECTION_OPTIONS,
          ID.unique(),
          {
            submission_id: submission.$id,
            option_number: option.number,
            title: option.title,
            background: option.background,
            journal_title: option.journalTitle ?? '',
            journal_author: option.journalAuthor ?? '',
            journal_file_id: fileId,
            is_selected_by_lecturer: false,
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
      return response.documents as unknown as SubmissionOption[];
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
   * Get complete submission with hydrated advisor, options, and approval logs.
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

    if (sub.advisor_id) {
      sub.advisor = await this.getLecturer(sub.advisor_id);
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

    return sub;
  },

  /**
   * Get all submissions for a student with detailed options and advisor.
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
            sub.advisor = await this.getLecturer(sub.advisor_id);
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
