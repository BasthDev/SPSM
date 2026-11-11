import { databases, storage } from './appwrite';
import { ID, Query } from 'react-native-appwrite';
import {
  DATABASE_ID,
  COLLECTION_SUBMISSIONS,
  COLLECTION_OPTIONS,
  COLLECTION_SURAT,
  COLLECTION_APPROVAL_LOGS,
  COLLECTION_LECTURERS,
  BUCKET_JOURNALS,
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

export const submissionService = {
  /**
   * Create a new thesis submission with dynamic N title options
   * and student's candidate advisors.
   */
  async createSubmission(
    studentId: string,
    optionsData: OptionFormData[],
    preferredAdvisor1Id?: string,
    preferredAdvisor2Id?: string
  ): Promise<ThesisSubmission> {
    try {
      // 1. Create the main submission header
      const submission = await databases.createDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_SUBMISSIONS,
        documentId: ID.unique(),
        data: {
          student_id: studentId,
          advisor_1_id: preferredAdvisor1Id || null,
          advisor_2_id: preferredAdvisor2Id || null,
          preferred_advisor_1_id: preferredAdvisor1Id || null,
          preferred_advisor_2_id: preferredAdvisor2Id || null,
          status: 'pending_lecturer',
          submitted_at: new Date().toISOString(),
        },
      });

      // 2. Create each title option (1..N)
      for (const option of optionsData) {
        let fileId: string | null = null;

        // Upload PDF journal if provided
        if (option.pdfFile) {
          try {
            const uploadedFile = await storage.createFile({
              bucketId: BUCKET_JOURNALS,
              fileId: ID.unique(),
              file: option.pdfFile,
            });
            fileId = uploadedFile.$id;
          } catch (uploadErr) {
            console.warn('PDF upload warning:', uploadErr);
          }
        }

        const relevanceTableObj = {
          variable: option.relevanceVariable || '',
          methodology: option.relevanceMethodology || '',
          note: option.relevanceNote || '',
        };

        await databases.createDocument({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_OPTIONS,
          documentId: ID.unique(),
          data: {
            submission_id: submission.$id,
            option_number: option.number,
            title: option.title,
            background: option.background || '',
            relevance_table: JSON.stringify(relevanceTableObj),
            relevance_variable: option.relevanceVariable ?? '',
            relevance_methodology: option.relevanceMethodology ?? '',
            relevance_note: option.relevanceNote ?? '',
            journal_title: option.journalTitle ?? '',
            journal_author: option.journalAuthor ?? '',
            journal_year: option.journalYear ?? '',
            journal_file_id: fileId,
            is_selected: false,
          },
        });
      }

      // 3. Record student submission action in approval_logs
      await databases.createDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_APPROVAL_LOGS,
        documentId: ID.unique(),
        data: {
          submission_id: submission.$id,
          actor_id: studentId,
          action: 'SUBMIT_MAHASISWA',
          notes: `Mahasiswa mengajukan ${optionsData.length} usulan judul skripsi`,
          created_at: new Date().toISOString(),
        },
      });

      return submission as unknown as ThesisSubmission;
    } catch (error: any) {
      throw new Error(`Gagal mengirim pengajuan: ${error.message}`);
    }
  },

  /**
   * Resubmit a revision when status is 'revision' or 'rejected'.
   */
  async resubmitRevision(
    submissionId: string,
    optionsData: OptionFormData[]
  ): Promise<void> {
    try {
      // 1. Get existing options
      const existingOptions = await this.getSubmissionOptions(submissionId);

      // 2. Update or recreate options
      for (const option of optionsData) {
        const existing = existingOptions.find((o) => o.option_number === option.number);
        let fileId = existing?.journal_file_id || null;

        if (option.pdfFile) {
          try {
            const uploaded = await storage.createFile({
              bucketId: BUCKET_JOURNALS,
              fileId: ID.unique(),
              file: option.pdfFile,
            });
            fileId = uploaded.$id;
          } catch (e) {
            console.warn('File upload warning:', e);
          }
        }

        const relevanceTableObj = {
          variable: option.relevanceVariable || '',
          methodology: option.relevanceMethodology || '',
          note: option.relevanceNote || '',
        };

        const payload: Record<string, any> = {
          title: option.title,
          background: option.background || '',
          relevance_table: JSON.stringify(relevanceTableObj),
          relevance_variable: option.relevanceVariable || '',
          relevance_methodology: option.relevanceMethodology || '',
          relevance_note: option.relevanceNote || '',
          journal_title: option.journalTitle || '',
          journal_author: option.journalAuthor || '',
          journal_year: option.journalYear || '',
          journal_file_id: fileId,
          is_selected: false,
        };

        if (existing) {
          await databases.updateDocument({
            databaseId: DATABASE_ID,
            collectionId: COLLECTION_OPTIONS,
            documentId: existing.$id,
            data: payload,
          });
        } else {
          await databases.createDocument({
            databaseId: DATABASE_ID,
            collectionId: COLLECTION_OPTIONS,
            documentId: ID.unique(),
            data: {
              submission_id: submissionId,
              option_number: option.number,
              ...payload,
            },
          });
        }
      }

      // 3. Reset status to pending_lecturer
      await databases.updateDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_SUBMISSIONS,
        documentId: submissionId,
        data: {
          status: 'pending_lecturer',
          submitted_at: new Date().toISOString(),
        },
      });

      // 4. Log the revision submission
      await databases.createDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_APPROVAL_LOGS,
        documentId: ID.unique(),
        data: {
          submission_id: submissionId,
          actor_id: 'Mahasiswa',
          action: 'REVISI_MAHASISWA',
          notes: 'Mahasiswa mengirimkan revisi judul skripsi',
          created_at: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      throw new Error(`Gagal mengirim revisi: ${err.message}`);
    }
  },

  /**
   * Get all submissions for a specific student.
   */
  async getStudentSubmissions(studentId: string): Promise<ThesisSubmission[]> {
    try {
      const response = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_SUBMISSIONS,
        queries: [
          Query.equal('student_id', studentId),
          Query.orderDesc('submitted_at'),
        ],
      });
      return response.documents as unknown as ThesisSubmission[];
    } catch (error: any) {
      throw new Error(`Gagal mengambil daftar pengajuan: ${error.message}`);
    }
  },

  /**
   * Get all submissions for a student with full hydrated details.
   */
  async getStudentSubmissionsWithDetails(studentId: string): Promise<ThesisSubmission[]> {
    const subs = await this.getStudentSubmissions(studentId);
    return this.hydrateSubmissions(subs);
  },

  /**
   * Get a single submission by ID.
   */
  async getSubmission(submissionId: string): Promise<ThesisSubmission> {
    try {
      const doc = await databases.getDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_SUBMISSIONS,
        documentId: submissionId,
      });
      return doc as unknown as ThesisSubmission;
    } catch (error: any) {
      throw new Error(`Gagal mengambil detail pengajuan: ${error.message}`);
    }
  },

  /**
   * Get a single submission with full details (hydrated).
   */
  async getSubmissionWithDetails(submissionId: string): Promise<ThesisSubmission | null> {
    try {
      const sub = await this.getSubmission(submissionId);
      if (!sub) return null;
      const [hydrated] = await this.hydrateSubmissions([sub]);
      return hydrated;
    } catch (error: any) {
      console.warn('Failed to load submission with details:', error);
      return null;
    }
  },

  /**
   * Get all options for a given submission.
   */
  async getSubmissionOptions(submissionId: string): Promise<SubmissionOption[]> {
    try {
      const response = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_OPTIONS,
        queries: [
          Query.equal('submission_id', submissionId),
          Query.orderAsc('option_number'),
        ],
      });
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
      const doc = await databases.getDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_LECTURERS,
        documentId: advisorId,
      });
      return doc as unknown as LecturerItem;
    } catch {
      try {
        const res = await databases.listDocuments({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_LECTURERS,
          queries: [Query.equal('nip', advisorId), Query.limit(1)],
        });
        if (res.documents.length > 0) return res.documents[0] as unknown as LecturerItem;
      } catch {
        // ignore
      }
      return null;
    }
  },

  /**
   * Get all lecturers with active status.
   */
  async getLecturers(): Promise<LecturerItem[]> {
    try {
      const response = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_LECTURERS,
        queries: [Query.equal('is_active', true), Query.orderAsc('name'), Query.limit(100)],
      });
      return response.documents as unknown as LecturerItem[];
    } catch (error: any) {
      console.warn('Failed to fetch lecturers:', error);
      return [];
    }
  },

  /**
   * Get surat document associated with a submission.
   */
  async getSubmissionSurat(submissionId: string): Promise<SuratItem | null> {
    try {
      const res = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_SURAT,
        queries: [Query.equal('submission_id', submissionId), Query.limit(1)],
      });
      if (res.documents.length > 0) {
        return res.documents[0] as unknown as SuratItem;
      }
      return null;
    } catch (e) {
      console.warn('Error fetching surat document:', e);
      return null;
    }
  },

  /**
   * Get approval logs for a submission.
   */
  async getApprovalLogs(submissionId: string): Promise<ApprovalLog[]> {
    try {
      const response = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_APPROVAL_LOGS,
        queries: [
          Query.equal('submission_id', submissionId),
          Query.orderAsc('created_at'),
        ],
      });
      return response.documents as unknown as ApprovalLog[];
    } catch (error: any) {
      console.warn('Error fetching approval logs:', error);
      return [];
    }
  },

  /**
   * Hydrates a submission with its options, advisors, surat, and logs.
   */
  async hydrateSubmissions(submissions: ThesisSubmission[]): Promise<ThesisSubmission[]> {
    return Promise.all(
      submissions.map(async (sub) => {
        try {
          const [options, logs, surat] = await Promise.all([
            this.getSubmissionOptions(sub.$id),
            this.getApprovalLogs(sub.$id),
            this.getSubmissionSurat(sub.$id),
          ]);

          sub.options = options;
          sub.logs = logs;
          sub.surat = surat;

          // Detect selected option
          sub.selectedOption =
            options.find((o) => o.is_selected || o.is_selected_by_lecturer) || null;

          // Populate advisor 1 & 2
          const adv1Id =
            sub.advisor_1_id || (sub.advisor_id ? sub.advisor_id.split(',')[0]?.trim() : undefined);
          const adv2Id =
            sub.advisor_2_id || (sub.advisor_id ? sub.advisor_id.split(',')[1]?.trim() : undefined);
          if (adv1Id) {
            sub.advisor = await this.getLecturer(adv1Id);
          }
          if (adv2Id) {
            sub.advisor2 = await this.getLecturer(adv2Id);
          }

          // Populate Surat info if available
          if (surat) {
            sub.nomor_surat = surat.nomor_surat;
            sub.urutan_surat = String(surat.urutan);
            sub.sk_generated_at = surat.created_at;
          }
        } catch (err) {
          console.warn('Hydration error:', err);
        }
        return sub;
      })
    );
  },

  /**
   * Get public file view URL for PDF from bucket.
   */
  getFileViewUrl(fileId: string): string {
    if (!fileId) return '';
    try {
      return storage.getFileViewURL(BUCKET_JOURNALS, fileId).toString();
    } catch {
      return '';
    }
  },

  /**
   * Get public file download URL for PDF from bucket.
   */
  getFileDownloadUrl(fileId: string): string {
    if (!fileId) return '';
    try {
      return storage.getFileDownloadURL(BUCKET_JOURNALS, fileId).toString();
    } catch {
      return '';
    }
  },

  /**
   * Get comparable titles for similarity checking.
   */
  async getComparableTitles(): Promise<{ title: string; submission_id: string }[]> {
    try {
      const res = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_OPTIONS,
        queries: [Query.limit(100)],
      });
      return res.documents.map((d: any) => ({
        title: d.title,
        submission_id: d.submission_id,
      }));
    } catch {
      return [];
    }
  },
};
