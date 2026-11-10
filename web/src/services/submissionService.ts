import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { lecturerService } from './lecturerService';
import type {
  ThesisSubmission,
  SubmissionOption,
  UserProfile,
  ApprovalLog,
  SubmissionStatus,
} from '../types';

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
  async getAllSubmissions(
    statusFilter?: SubmissionStatus,
    advisorIdFilter?: string
  ): Promise<ThesisSubmission[]> {
    try {
      const queries = [Query.orderDesc('$createdAt'), Query.limit(100)];
      if (statusFilter) {
        queries.push(Query.equal('status', statusFilter));
      }

      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        queries
      );

      let submissions = res.documents as unknown as ThesisSubmission[];

      // Filter by advisor if specified (handles comma-separated advisor_id)
      if (advisorIdFilter && advisorIdFilter !== 'all') {
        submissions = submissions.filter((sub) => {
          if (!sub.advisor_id) return false;
          const parts = sub.advisor_id.split(',').map((s) => s.trim());
          return parts.includes(advisorIdFilter);
        });
      }

      // Hydrate with options, students, advisors (1 & 2), preferred advisors, and logs
      const hydrated = await Promise.all(
        submissions.map(async (sub) => {
          try {
            // 1. Fetch options & parse relevance table
            const optionsRes = await databases.listDocuments(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.submissionOptions,
              [
                Query.equal('submission_id', sub.$id),
                Query.orderAsc('option_number'),
              ]
            );
            const opts = optionsRes.documents as unknown as SubmissionOption[];
            sub.options = opts.map(parseOptionRelevance);
          } catch {
            sub.options = [];
          }

          try {
            // 2. Fetch student info
            const userRes = await databases.listDocuments(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.users,
              [Query.equal('user_id', sub.student_id), Query.limit(1)]
            );
            if (userRes.documents.length > 0) {
              sub.student = userRes.documents[0] as unknown as UserProfile;
            }
          } catch {
            // fallback
          }

          try {
            // 3. Fetch advisor 1 & advisor 2 if assigned
            if (sub.advisor_id) {
              const parts = sub.advisor_id.split(',').map((s) => s.trim()).filter(Boolean);
              if (parts.length > 0) {
                sub.advisor = (await lecturerService.getLecturerById(parts[0])) || undefined;
              }
              if (parts.length > 1) {
                sub.advisor2 = (await lecturerService.getLecturerById(parts[1])) || undefined;
              }
            }
          } catch {
            // fallback
          }

          try {
            // 4. Fetch approval logs
            const logsRes = await databases.listDocuments(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.approvalLogs,
              [
                Query.equal('submission_id', sub.$id),
                Query.orderDesc('created_at'),
              ]
            );
            sub.logs = logsRes.documents as unknown as ApprovalLog[];

            // Hydrate student's 2 preferred advisors from PENGAJUAN_MAHASISWA log
            const studentLog = sub.logs.find((l) => l.action === 'PENGAJUAN_MAHASISWA');
            if (studentLog && studentLog.notes) {
              try {
                const parsed = JSON.parse(studentLog.notes);
                if (parsed.pref1) {
                  sub.preferredAdvisor1 =
                    (await lecturerService.getLecturerById(parsed.pref1)) || undefined;
                }
                if (parsed.pref2) {
                  sub.preferredAdvisor2 =
                    (await lecturerService.getLecturerById(parsed.pref2)) || undefined;
                }
              } catch {
                // ignore
              }
            }

            // Hydrate Nomor Surat & Urutan if approved
            const kaprodiLog = sub.logs.find(
              (l) => l.action === 'DISAHKAN_KAPRODI' || l.action?.toUpperCase().includes('KAPRODI')
            );
            if (kaprodiLog && kaprodiLog.notes) {
              try {
                if (kaprodiLog.notes.startsWith('{')) {
                  const parsed = JSON.parse(kaprodiLog.notes);
                  sub.nomor_surat = parsed.nomor_surat || null;
                  sub.urutan_surat = parsed.urutan || null;
                  sub.sk_generated_at = parsed.generated_at || kaprodiLog.created_at;
                  if (parsed.text) {
                    kaprodiLog.notes = parsed.text;
                  }
                }
              } catch {
                // ignore
              }
            }

            // Fallback for approved submissions if not saved in log yet
            if (sub.status === 'approved' && !sub.nomor_surat) {
              const year = sub.$createdAt ? new Date(sub.$createdAt).getFullYear() : new Date().getFullYear();
              const prodi = extractProdiCode(sub.student?.department);
              const angkatan = extractAngkatan(sub.student?.batch_year);
              const approvedList = submissions.filter((s) => s.status === 'approved');
              const idx = approvedList.indexOf(sub);
              const seq = idx >= 0 ? approvedList.length - idx : 1;
              const { nomor_surat, urutan } = formatNomorSurat(seq, prodi, angkatan, year);
              sub.nomor_surat = nomor_surat;
              sub.urutan_surat = urutan;
              sub.sk_generated_at = sub.$createdAt || new Date().toISOString();
            }

            // Hydrate per-option revision/rejection notes if present
            const decisionLog = sub.logs.find(
              (l) => l.action === 'MINTA_REVISI' || l.action === 'DITOLAK'
            );
            if (decisionLog && decisionLog.notes && sub.options) {
              sub.options.forEach((opt) => {
                const regex = new RegExp(`Judul\\s*#?${opt.option_number}\\s*:\\s*([^\\n]+)`, 'i');
                const m = decisionLog.notes!.match(regex);
                if (m && m[1]) {
                  opt.revision_note = m[1].trim();
                }
              });
            }
          } catch {
            sub.logs = [];
          }

          return sub;
        })
      );

      return hydrated;
    } catch (err) {
      console.error('Failed to get submissions:', err);
      return [];
    }
  },

  /**
   * Reviewer selects best title option and assigns BOTH Dosen Pembimbing 1 and Pembimbing 2.
   */
  async reviewAndSelectTitle(
    submissionId: string,
    selectedOptionId: string,
    advisor1Id: string,
    advisor2Id: string,
    reviewerName: string,
    notes: string
  ): Promise<void> {
    // 1. Get all options for this submission
    const optionsRes = await databases.listDocuments(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.submissionOptions,
      [Query.equal('submission_id', submissionId)]
    );

    // 2. Update options: selected is true, others false
    for (const opt of optionsRes.documents) {
      const isSelected = opt.$id === selectedOptionId;
      if (opt.is_selected_by_lecturer !== isSelected) {
        await databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.submissionOptions,
          opt.$id,
          { is_selected_by_lecturer: isSelected }
        );
      }
    }

    // Combine advisor IDs (Pembimbing 1 and Pembimbing 2)
    const combinedAdvisorId = advisor2Id
      ? `${advisor1Id.trim()},${advisor2Id.trim()}`
      : advisor1Id.trim();

    // 3. Update thesis submission status to 'waiting_kaprodi' and set combined advisor_id
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'waiting_kaprodi',
        advisor_id: combinedAdvisorId,
      }
    );

    // 4. Add approval log
    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: reviewerName,
        action: 'VERIFIKASI_DOSEN_PENILAI',
        notes: notes || 'Judul skripsi terpilih serta Dosen Pembimbing 1 & 2 telah ditetapkan.',
        created_at: new Date().toISOString(),
      }
    );
  },

  /**
   * Kaprodi gives final endorsement (Approval).
   * Kaprodi can also modify Pembimbing 1 or 2 before approving.
   */
  async kaprodiApprove(
    submissionId: string,
    advisor1Id: string,
    advisor2Id: string,
    kaprodiName: string,
    notes: string
  ): Promise<void> {
    const combinedAdvisorId = advisor2Id
      ? `${advisor1Id.trim()},${advisor2Id.trim()}`
      : advisor1Id.trim();

    // 1. Update submission status to 'approved' and ensure advisor_id is updated
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'approved',
        advisor_id: combinedAdvisorId,
      }
    );

    // 2. Automatically sync student quota for both advisors
    if (advisor1Id) {
      await lecturerService.syncStudentCount(advisor1Id.trim());
    }
    if (advisor2Id && advisor2Id.trim() !== advisor1Id.trim()) {
      await lecturerService.syncStudentCount(advisor2Id.trim());
    }

    // 3. Generate Nomor Surat Otomatis: URUTAN/SPSM/PRODI/ANGKATAN/TAHUN
    const currentYear = new Date().getFullYear();
    let approvedCountThisYear = 0;
    try {
      const approvedRes = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        [Query.equal('status', 'approved'), Query.limit(100)]
      );
      approvedCountThisYear = approvedRes.documents.filter((doc) => {
        const docYear = new Date(doc.$createdAt).getFullYear();
        return docYear === currentYear;
      }).length;
    } catch {
      approvedCountThisYear = 1;
    }

    // Determine prodi & angkatan from student user profile
    let prodiCode = 'TI';
    let angkatan = '23';
    let studentId = '';
    try {
      const subDoc = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        submissionId
      );
      studentId = subDoc.student_id;
      if (subDoc.student_id) {
        const userRes = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.users,
          [Query.equal('user_id', subDoc.student_id), Query.limit(1)]
        );
        if (userRes.documents.length > 0) {
          const u = userRes.documents[0] as unknown as UserProfile;
          prodiCode = extractProdiCode(u.department);
          angkatan = extractAngkatan(u.batch_year);
        }
      }
    } catch {
      // fallback
    }

    const { nomor_surat, urutan } = formatNomorSurat(
      approvedCountThisYear,
      prodiCode,
      angkatan,
      currentYear
    );

    // 4. Add approval log with structured payload including nomor_surat
    const logPayload = {
      nomor_surat,
      urutan,
      text: notes || 'Judul dan Dosen Pembimbing resmi disahkan oleh Kaprodi.',
      generated_at: new Date().toISOString(),
    };

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: kaprodiName,
        action: 'DISAHKAN_KAPRODI',
        notes: JSON.stringify(logPayload),
        created_at: new Date().toISOString(),
      }
    );

    // 5. Relate to 'surat' table in database if available
    try {
      await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        'surat',
        ID.unique(),
        {
          submission_id: submissionId,
          student_id: studentId,
          nomor_surat,
          urutan,
          prodi: prodiCode,
          angkatan,
          tahun: currentYear,
          created_at: new Date().toISOString(),
        }
      );
    } catch {
      // Optional if surat collection doesn't exist yet in Appwrite
    }
  },

  /**
   * Reject submission with structured notes for each of the 3 title options.
   * All 3 options are automatically unmarked/rejected.
   */
  async rejectSubmission(
    submissionId: string,
    actorName: string,
    noteOpt1: string,
    noteOpt2: string,
    noteOpt3: string,
    generalNotes?: string,
    advisorId?: string
  ): Promise<void> {
    // 1. Unmark all title options
    try {
      const optionsRes = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.submissionOptions,
        [Query.equal('submission_id', submissionId)]
      );
      for (const opt of optionsRes.documents) {
        if (opt.is_selected_by_lecturer) {
          await databases.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.submissionOptions,
            opt.$id,
            { is_selected_by_lecturer: false }
          );
        }
      }
    } catch {
      // ignore
    }

    // 2. Update submission status to rejected
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'rejected',
      }
    );

    // 3. Sync quotas if advisor was previously set
    if (advisorId) {
      const parts = advisorId.split(',').map((s) => s.trim()).filter(Boolean);
      for (const adv of parts) {
        await lecturerService.syncStudentCount(adv);
      }
    }

    // 4. Structured log format
    const structuredNotes = `Catatan Penolakan per Judul:\nJudul 1: ${noteOpt1 || 'Tidak memenuhi kualifikasi penelitian.'}\nJudul 2: ${noteOpt2 || 'Tidak memenuhi kualifikasi penelitian.'}\nJudul 3: ${noteOpt3 || 'Tidak memenuhi kualifikasi penelitian.'}${generalNotes ? `\n\nCatatan Tambahan: ${generalNotes}` : ''}`;

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: actorName,
        action: 'DITOLAK',
        notes: structuredNotes,
        created_at: new Date().toISOString(),
      }
    );
  },

  /**
   * Request revision with structured notes for each of the 3 title options.
   * All 3 options are marked for revision.
   */
  async requestRevision(
    submissionId: string,
    actorName: string,
    noteOpt1: string,
    noteOpt2: string,
    noteOpt3: string,
    generalNotes?: string,
    advisorId?: string
  ): Promise<void> {
    // 1. Unmark all title options
    try {
      const optionsRes = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.submissionOptions,
        [Query.equal('submission_id', submissionId)]
      );
      for (const opt of optionsRes.documents) {
        if (opt.is_selected_by_lecturer) {
          await databases.updateDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.submissionOptions,
            opt.$id,
            { is_selected_by_lecturer: false }
          );
        }
      }
    } catch {
      // ignore
    }

    // 2. Update submission status to revision
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'revision',
      }
    );

    // 3. Sync quotas if advisor was previously set
    if (advisorId) {
      const parts = advisorId.split(',').map((s) => s.trim()).filter(Boolean);
      for (const adv of parts) {
        await lecturerService.syncStudentCount(adv);
      }
    }

    // 4. Structured log format
    const structuredNotes = `Catatan Revisi per Judul:\nJudul 1: ${noteOpt1 || 'Perlu perbaikan rumusan masalah.'}\nJudul 2: ${noteOpt2 || 'Perlu perbaikan rumusan masalah.'}\nJudul 3: ${noteOpt3 || 'Perlu perbaikan rumusan masalah.'}${generalNotes ? `\n\nCatatan Tambahan: ${generalNotes}` : ''}`;

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: actorName,
        action: 'MINTA_REVISI',
        notes: structuredNotes,
        created_at: new Date().toISOString(),
      }
    );
  },

  /**
   * Aggregates total verified submissions (waiting_kaprodi + approved),
   * excluding rejected and revision.
   */
  calculateTotalVerified(submissions: ThesisSubmission[]): number {
    return submissions.filter(
      (s) => s.status === 'waiting_kaprodi' || s.status === 'approved'
    ).length;
  },

  getFileViewUrl(fileId: string): string {
    if (!fileId) return '#';
    try {
      return storage.getFileView(
        APPWRITE_CONFIG.storageBucketId,
        fileId
      ).toString();
    } catch {
      return '#';
    }
  },
};
