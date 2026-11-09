import { databases, storage, APPWRITE_CONFIG, ID, Query } from '../lib/appwrite';
import { lecturerService } from './lecturerService';
import type {
  ThesisSubmission,
  SubmissionOption,
  UserProfile,
  ApprovalLog,
  SubmissionStatus,
} from '../types';

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
      if (advisorIdFilter && advisorIdFilter !== 'all') {
        queries.push(Query.equal('advisor_id', advisorIdFilter));
      }

      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.thesisSubmissions,
        queries
      );

      const submissions = res.documents as unknown as ThesisSubmission[];

      // Hydrate with options, students, advisors, and logs
      const hydrated = await Promise.all(
        submissions.map(async (sub) => {
          try {
            // 1. Fetch options
            const optionsRes = await databases.listDocuments(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.submissionOptions,
              [
                Query.equal('submission_id', sub.$id),
                Query.orderAsc('option_number'),
              ]
            );
            sub.options = optionsRes.documents as unknown as SubmissionOption[];
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
            // 3. Fetch advisor info if assigned
            if (sub.advisor_id) {
              sub.advisor = (await lecturerService.getLecturerById(
                sub.advisor_id
              )) || undefined;
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

  async reviewAndSelectTitle(
    submissionId: string,
    selectedOptionId: string,
    advisorId: string,
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

    // 3. Update thesis submission status to 'waiting_kaprodi' and set advisor_id
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'waiting_kaprodi',
        advisor_id: advisorId,
      }
    );

    // 4. Add log
    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: reviewerName,
        action: 'VERIFIKASI_DOSEN_PENILAI',
        notes: notes || 'Judul skripsi dan calon Dosen Pembimbing telah dipilih.',
        created_at: new Date().toISOString(),
      }
    );
  },

  async kaprodiApprove(
    submissionId: string,
    advisorId: string,
    kaprodiName: string,
    notes: string
  ): Promise<void> {
    // 1. Update submission status to 'approved'
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'approved',
      }
    );

    // 2. Automatically sync and increment advisor quota
    if (advisorId) {
      await lecturerService.syncStudentCount(advisorId);
    }

    // 3. Add approval log
    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: kaprodiName,
        action: 'DISAHKAN_KAPRODI',
        notes: notes || 'Judul dan Dosen Pembimbing telah disahkan oleh Kaprodi.',
        created_at: new Date().toISOString(),
      }
    );
  },

  async rejectSubmission(
    submissionId: string,
    actorName: string,
    notes: string,
    advisorId?: string
  ): Promise<void> {
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'rejected',
      }
    );

    if (advisorId) {
      await lecturerService.syncStudentCount(advisorId);
    }

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: actorName,
        action: 'DITOLAK',
        notes: notes || 'Pengajuan ditolak.',
        created_at: new Date().toISOString(),
      }
    );
  },

  async requestRevision(
    submissionId: string,
    actorName: string,
    notes: string,
    advisorId?: string
  ): Promise<void> {
    await databases.updateDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.thesisSubmissions,
      submissionId,
      {
        status: 'revision',
      }
    );

    if (advisorId) {
      await lecturerService.syncStudentCount(advisorId);
    }

    await databases.createDocument(
      APPWRITE_CONFIG.databaseId,
      APPWRITE_CONFIG.collections.approvalLogs,
      ID.unique(),
      {
        submission_id: submissionId,
        actor_id: actorName,
        action: 'MINTA_REVISI',
        notes: notes || 'Perlu perbaikan judul atau latar belakang.',
        created_at: new Date().toISOString(),
      }
    );
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
