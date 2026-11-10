import { databases, storage } from './appwrite';
import { ID, Query } from 'react-native-appwrite';
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
 * Contoh: 01/SPSM/BD/23/2026
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
      const submission = await databases.createDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_SUBMISSIONS,
        documentId: ID.unique(),
        data: {
          student_id: studentId,
          status: 'pending_lecturer',
          submitted_at: new Date().toISOString(),
        },
      });

      // 2. Create each title option (encoding relevance table if present)
      for (const option of optionsData) {
        let fileId: string | null = null;

        // Upload PDF journal if provided
        if (option.pdfFile) {
          const uploadedFile = await storage.createFile({
            bucketId: BUCKET_JOURNALS,
            fileId: ID.unique(),
            file: option.pdfFile,
          });
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

        await databases.createDocument({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_OPTIONS,
          documentId: ID.unique(),
          data: {
            submission_id: submission.$id,
            option_number: option.number,
            title: option.title,
            background: finalBackground,
            journal_title: option.journalTitle ?? '',
            journal_author: option.journalAuthor ?? '',
            journal_file_id: fileId,
            is_selected_by_lecturer: false,
          },
        });
      }

      // 3. Record student's 2 preferred advisors in an initial log
      if (preferredAdvisor1Id || preferredAdvisor2Id) {
        let name1 = '';
        let name2 = '';
        if (preferredAdvisor1Id) {
          const l1 = await this.getLecturer(preferredAdvisor1Id);
          if (l1?.name) name1 = l1.name;
        }
        if (preferredAdvisor2Id) {
          const l2 = await this.getLecturer(preferredAdvisor2Id);
          if (l2?.name) name2 = l2.name;
        }

        await databases.createDocument({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_APPROVAL_LOGS,
          documentId: ID.unique(),
          data: {
            submission_id: submission.$id,
            actor_id: 'Mahasiswa (Pemohon)',
            action: 'PENGAJUAN_MAHASISWA',
            notes: JSON.stringify({
              pref1: preferredAdvisor1Id || null,
              pref2: preferredAdvisor2Id || null,
              pref1_name: name1 || null,
              pref2_name: name2 || null,
            }),
            created_at: new Date().toISOString(),
          },
        });
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
          queries: [Query.equal('user_id', advisorId), Query.limit(1)],
        });
        if (res.documents.length > 0) return res.documents[0] as unknown as LecturerItem;
      } catch {
        // ignore
      }
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
          Query.orderDesc('created_at'),
        ],
      });
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
        if (parsed.pref1) {
          sub.preferredAdvisor1 =
            (await this.getLecturer(parsed.pref1)) ||
            (parsed.pref1_name ? ({ name: parsed.pref1_name, $id: parsed.pref1 } as LecturerItem) : null);
        }
        if (parsed.pref2) {
          sub.preferredAdvisor2 =
            (await this.getLecturer(parsed.pref2)) ||
            (parsed.pref2_name ? ({ name: parsed.pref2_name, $id: parsed.pref2 } as LecturerItem) : null);
        }
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

      // Extract nomor_surat if available
      if (kaprodiLog.notes && kaprodiLog.notes.startsWith('{')) {
        try {
          const parsed = JSON.parse(kaprodiLog.notes);
          sub.nomor_surat = parsed.nomor_surat || null;
          sub.urutan_surat = parsed.urutan || null;
          sub.sk_generated_at = parsed.generated_at || kaprodiLog.created_at;
          if (parsed.text) sub.kaprodiNotes = parsed.text;
        } catch {
          // ignore
        }
      }
    }

    // Fallback nomor surat if approved
    if (sub.status === 'approved' && !sub.nomor_surat) {
      const year = sub.$createdAt ? new Date(sub.$createdAt).getFullYear() : new Date().getFullYear();
      const { nomor_surat, urutan } = formatNomorSurat(1, 'TI', '23', year);
      sub.nomor_surat = nomor_surat;
      sub.urutan_surat = urutan;
      sub.sk_generated_at = sub.kaprodiApprovalDate || sub.$createdAt || new Date().toISOString();
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
              if (parsed.pref1) {
                sub.preferredAdvisor1 =
                  (await this.getLecturer(parsed.pref1)) ||
                  (parsed.pref1_name ? ({ name: parsed.pref1_name, $id: parsed.pref1 } as LecturerItem) : null);
              }
              if (parsed.pref2) {
                sub.preferredAdvisor2 =
                  (await this.getLecturer(parsed.pref2)) ||
                  (parsed.pref2_name ? ({ name: parsed.pref2_name, $id: parsed.pref2 } as LecturerItem) : null);
              }
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

            if (kaprodiLog.notes && kaprodiLog.notes.startsWith('{')) {
              try {
                const parsed = JSON.parse(kaprodiLog.notes);
                sub.nomor_surat = parsed.nomor_surat || null;
                sub.urutan_surat = parsed.urutan || null;
                sub.sk_generated_at = parsed.generated_at || kaprodiLog.created_at;
                if (parsed.text) sub.kaprodiNotes = parsed.text;
              } catch {
                // ignore
              }
            }
          }

          if (sub.status === 'approved' && !sub.nomor_surat) {
            const year = sub.$createdAt ? new Date(sub.$createdAt).getFullYear() : new Date().getFullYear();
            const { nomor_surat, urutan } = formatNomorSurat(1, 'TI', '23', year);
            sub.nomor_surat = nomor_surat;
            sub.urutan_surat = urutan;
            sub.sk_generated_at = sub.kaprodiApprovalDate || sub.$createdAt || new Date().toISOString();
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
      return storage.getFileViewURL(BUCKET_JOURNALS, fileId).toString();
    } catch {
      return '';
    }
  },

  /**
   * Get all title options from active submissions (excludes rejected/revision)
   * for similarity checking. Paginates through all submissions and options.
   */
  async getComparableTitles(): Promise<{ title: string; submission_id: string }[]> {
    try {
      // 1. Fetch all submissions -> map id to status
      const submissions: { $id: string; status: string }[] = [];
      let cursor: string | undefined;
      while (true) {
        const queries = [Query.orderDesc('submitted_at'), Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_SUBMISSIONS,
          queries,
        });
        submissions.push(...(res.documents as any[]));
        if (res.documents.length < 100) break;
        cursor = res.documents[res.documents.length - 1].$id;
      }

      const statusMap = new Map(submissions.map((s) => [s.$id, s.status]));

      // 2. Fetch all options -> filter out rejected/revision submissions, dedupe titles
      const titles: { title: string; submission_id: string }[] = [];
      const seen = new Set<string>();
      cursor = undefined;
      while (true) {
        const queries = [Query.orderAsc('option_number'), Query.limit(100)];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await databases.listDocuments({
          databaseId: DATABASE_ID,
          collectionId: COLLECTION_OPTIONS,
          queries,
        });
        for (const doc of res.documents as any[]) {
          const status = statusMap.get(doc.submission_id);
          if (status === 'rejected' || status === 'revision') continue;
          const title = (doc.title || '').trim();
          if (!title) continue;
          const key = title.toLowerCase().replace(/\s+/g, ' ');
          if (seen.has(key)) continue;
          seen.add(key);
          titles.push({ title, submission_id: doc.submission_id });
        }
        if (res.documents.length < 100) break;
        cursor = res.documents[res.documents.length - 1].$id;
      }

      return titles;
    } catch (error: any) {
      console.error('Failed to fetch comparable titles:', error);
      return [];
    }
  },
};
