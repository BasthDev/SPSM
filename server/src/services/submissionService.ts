import { db } from '../database';
import {
  SubmissionDto,
  SubmissionStatus,
  normalizeSubmissionStatus,
} from '../database/types';
import { CreateSubmissionInput } from '../validators/submissionValidator';
import { masterDataService } from './masterDataService';
import { notifySubmissionStatus } from './notificationService';
import { storageAdapter } from '../storage';

/** Patch fields whitelist for updateStatus — never merge arbitrary keys. */
const ALLOWED_STATUS_PATCH_KEYS = [
  'selectedOptionId',
  'scannedSkId',
  'reviewerNotes',
  'kaprodiNotes',
  'advisor1Id',
  'advisor2Id',
] as const;

export interface ResubmitUser {
  userId?: string;
  role?: string;
  isAdmin?: boolean;
}

/** Lecturer ids may be doc ids OR NIPs depending on the client — try both. */
async function resolveLecturer(id?: string | null) {
  if (!id) return null;
  const byId = await db.getLecturerById(id).catch(() => null);
  if (byId) return byId;
  return db.getLecturerByNip(id).catch(() => null);
}

export class SubmissionService {
  /**
   * Orchestrate submission creation and related options + approval logs
   */
  async createSubmission(input: CreateSubmissionInput): Promise<SubmissionDto> {
    // 1. Create main submission record.
    // NOTE: preferred advisors are NOT copied into advisor1Id/advisor2Id —
    // preferred_* are student choices; advisor_* are assigned later by reviewer/kaprodi.
    const submission = await db.createSubmission({
      studentId: input.studentId,
      preferredAdvisor1Id: input.preferredAdvisor1Id || null,
      preferredAdvisor2Id: input.preferredAdvisor2Id || null,
      advisor1Id: null,
      advisor2Id: null,
      status: 'pending_lecturer',
      submittedAt: new Date().toISOString(),
    });

    // 2. Create options
    for (const opt of input.options) {
      const relevanceTableObj = {
        variable: opt.relevanceVariable || '',
        methodology: opt.relevanceMethodology || '',
        note: opt.relevanceNote || '',
      };

      const created = await db.createSubmissionOption({
        submissionId: submission.id,
        optionNumber: opt.number,
        title: opt.title.trim(),
        background: opt.background || '',
        relevanceTable: JSON.stringify(relevanceTableObj),
        relevanceVariable: opt.relevanceVariable || '',
        relevanceMethodology: opt.relevanceMethodology || '',
        relevanceNote: opt.relevanceNote || '',
        journalTitle: opt.journalTitle || '',
        journalAuthor: opt.journalAuthor || '',
        journalYear: opt.journalYear || '',
        journalFileId: opt.journalFileId || null,
        isSelected: false,
      });

      // Reference journal PDFs live in the shared journals bucket together with
      // thesis/repo files. Prefix their stored name so repo listings can exclude
      // them (they are per-option reference material, not repository documents).
      if (created.journalFileId) {
        try {
          await this.tagReferenceJournalFile(created.journalFileId, created.id);
        } catch (e) {
          console.warn('Failed to tag reference journal file name:', e);
        }
      }
    }

    // 3. Record approval log (PENGAJUAN_MAHASISWA)
    let pref1Name = '';
    let pref2Name = '';
    if (input.preferredAdvisor1Id) {
      const l1 = await resolveLecturer(input.preferredAdvisor1Id);
      pref1Name = l1?.name || '';
    }
    if (input.preferredAdvisor2Id) {
      const l2 = await resolveLecturer(input.preferredAdvisor2Id);
      pref2Name = l2?.name || '';
    }

    await db.createApprovalLog({
      submissionId: submission.id,
      actorId: input.studentId,
      action: 'PENGAJUAN_MAHASISWA',
      notes: JSON.stringify({
        text: `Mahasiswa mengajukan ${input.options.length} usulan judul skripsi`,
        pref1: input.preferredAdvisor1Id || null,
        pref1_name: pref1Name || null,
        pref2: input.preferredAdvisor2Id || null,
        pref2_name: pref2Name || null,
      }),
      createdAt: new Date().toISOString(),
    });

    // 4. Return hydrated submission
    return (await this.getSubmissionById(submission.id)) || submission;
  }

  /**
   * Resubmit revision for existing submission.
   * Guards: submission must exist, caller must own it (students) unless
   * admin/lecturer/kaprodi/akademik, and status must be revision or rejected.
   */
  async resubmitRevision(
    submissionId: string,
    options: CreateSubmissionInput['options'],
    user?: ResubmitUser
  ): Promise<SubmissionDto> {
    const existing = await db.getSubmissionById(submissionId);
    if (!existing) {
      const err: any = new Error('Pengajuan tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    const privileged =
      user?.isAdmin ||
      ['admin', 'kaprodi', 'akademik', 'lecturer', 'reviewer'].includes(user?.role || '');
    if (!privileged && user?.userId && existing.studentId !== user.userId) {
      const err: any = new Error('Anda tidak memiliki akses untuk merevisi pengajuan ini.');
      err.statusCode = 403;
      throw err;
    }

    const status = normalizeSubmissionStatus(existing.status);
    if (status !== 'revision' && status !== 'rejected') {
      const err: any = new Error('Hanya pengajuan berstatus perlu revisi atau ditolak yang dapat diajukan ulang.');
      err.statusCode = 409;
      throw err;
    }

    // Capture old option ids BEFORE creating replacements so we can delete
    // exactly those afterwards (create-first minimizes data-loss window).
    const oldOptions = await db.getOptionsBySubmissionId(submissionId);

    // Create replacement options FIRST, then delete old ones —
    // minimizes the window where the submission has no options.
    for (const opt of options) {
      const relevanceTableObj = {
        variable: opt.relevanceVariable || '',
        methodology: opt.relevanceMethodology || '',
        note: opt.relevanceNote || '',
      };

      const created = await db.createSubmissionOption({
        submissionId: submissionId,
        optionNumber: opt.number,
        title: opt.title.trim(),
        background: opt.background || '',
        relevanceTable: JSON.stringify(relevanceTableObj),
        relevanceVariable: opt.relevanceVariable || '',
        relevanceMethodology: opt.relevanceMethodology || '',
        relevanceNote: opt.relevanceNote || '',
        journalTitle: opt.journalTitle || '',
        journalAuthor: opt.journalAuthor || '',
        journalYear: opt.journalYear || '',
        journalFileId: opt.journalFileId || null,
        isSelected: false,
      });
      if (created.journalFileId) {
        try {
          await this.tagReferenceJournalFile(created.journalFileId, created.id);
        } catch (e) {
          console.warn('Failed to tag reference journal file name:', e);
        }
      }
    }

    // Now safe to remove ONLY the previous option set (by id)
    for (const old of oldOptions) {
      try {
        await db.deleteSubmissionOption(old.id);
      } catch (e) {
        console.warn('Failed to delete old option during resubmit:', e);
      }
    }

    // Reset status to pending_lecturer
    await db.updateSubmission(submissionId, { status: 'pending_lecturer' });

    // Log action
    await db.createApprovalLog({
      submissionId,
      actorId: user?.userId || existing.studentId,
      action: 'REVISI_PENGAJUAN',
      notes: JSON.stringify({
        text: `Mahasiswa mengirim revisi dengan ${options.length} usulan judul`,
      }),
      createdAt: new Date().toISOString(),
    });

    return (await this.getSubmissionById(submissionId)) || existing;
  }

  /**
   * Update status with log
   */
  async updateStatus(
    submissionId: string,
    status: SubmissionStatus | string,
    actorId: string,
    action: string,
    notes?: string,
    patch?: any
  ): Promise<SubmissionDto> {
    const normalizedStatus = normalizeSubmissionStatus(status);
    if (!normalizedStatus) {
      const err: any = new Error(`Status tidak valid: ${status}`);
      err.statusCode = 400;
      throw err;
    }

    // Whitelist patchable fields only
    const safePatch: Record<string, any> = {};
    if (patch && typeof patch === 'object') {
      for (const key of ALLOWED_STATUS_PATCH_KEYS) {
        if (patch[key] !== undefined) safePatch[key] = patch[key];
      }
    }

    // Ambil studentId sebelum update untuk notifikasi push ke mahasiswa
    const prevSub = await db.getSubmissionById(submissionId).catch(() => null);
    const studentAppwriteId = prevSub?.studentId || null;

    const updatePayload: Partial<SubmissionDto> = {};
    if (safePatch.advisor1Id !== undefined) updatePayload.advisor1Id = safePatch.advisor1Id;
    if (safePatch.advisor2Id !== undefined) updatePayload.advisor2Id = safePatch.advisor2Id;
    if (safePatch.reviewerNotes !== undefined) updatePayload.reviewerNotes = safePatch.reviewerNotes;
    if (safePatch.kaprodiNotes !== undefined) updatePayload.kaprodiNotes = safePatch.kaprodiNotes;
    updatePayload.status = normalizedStatus as SubmissionStatus;

    await db.updateSubmission(submissionId, updatePayload);

    // If selectedOptionId is provided, update option selections
    // (is_selected + is_selected_by_lecturer on chosen, cleared on others)
    if (safePatch.selectedOptionId) {
      try {
        const options = await db.getOptionsBySubmissionId(submissionId);
        for (const opt of options) {
          const isSelected = opt.id === safePatch.selectedOptionId;
          const patchOpt: any = {};
          if (opt.isSelected !== isSelected) patchOpt.isSelected = isSelected;
          const wantLecturer = isSelected;
          if ((opt.isSelectedByLecturer ?? false) !== wantLecturer) {
            patchOpt.isSelectedByLecturer = wantLecturer;
          }
          if (Object.keys(patchOpt).length > 0) {
            await db.updateSubmissionOption(opt.id, patchOpt);
          }
        }
      } catch (err) {
        console.warn('Failed to update option selection:', err);
      }
    } else if (normalizedStatus === 'rejected' || normalizedStatus === 'revision') {
      try {
        const options = await db.getOptionsBySubmissionId(submissionId);
        for (const opt of options) {
          if (opt.isSelected || opt.isSelectedByLecturer) {
            await db.updateSubmissionOption(opt.id, {
              isSelected: false,
              isSelectedByLecturer: false,
            });
          }
        }
      } catch (err) {
        console.warn('Failed to clear option selection:', err);
      }
    }

    // If scannedSkId is provided, write it to surat.scanned_sk_id
    // (partial upsert preserves nomor_surat / urutan / no_dokumen)
    if (safePatch.scannedSkId) {
      try {
        await db.upsertSurat(submissionId, { scannedSkId: safePatch.scannedSkId });
      } catch (err) {
        console.warn('Failed to update surat with scannedSkId:', err);
      }
    }

    // When SK is issued, ensure a surat document exists
    if (normalizedStatus === 'sk_issued') {
      try {
        const existingSurat = await db.getSuratBySubmissionId(submissionId);
        if (!existingSurat) {
          const sub = await db.getSubmissionById(submissionId);
          const student = sub?.studentId
            ? await db.getUserProfileByUserId(sub.studentId).catch(() => null)
            : null;
          await masterDataService.generateSurat(
            submissionId,
            student?.department,
            student?.batchYear
          );
        }
      } catch (err) {
        console.warn('Failed to ensure surat on sk_issued:', err);
      }
    }

    await db.createApprovalLog({
      submissionId,
      actorId,
      action,
      notes: notes || '',
      createdAt: new Date().toISOString(),
    });

    // Notifikasi push ke mahasiswa (fire-and-forget, tidak boleh gagalkan update)
    void notifySubmissionStatus(studentAppwriteId, normalizedStatus, submissionId, notes);

    return (await this.getSubmissionById(submissionId))!;
  }

  /**
   * Hydrate full submission with student, options, advisors, surat, and logs
   */
  async getSubmissionById(id: string): Promise<SubmissionDto | null> {
    const sub = await db.getSubmissionById(id);
    if (!sub) return null;

    const [options, logs, student, adv1, adv2, pref1, pref2, surat] = await Promise.all([
      db.getOptionsBySubmissionId(id),
      db.getApprovalLogsBySubmissionId(id),
      db.getUserProfileByUserId(sub.studentId).catch(() => null),
      resolveLecturer(sub.advisor1Id),
      resolveLecturer(sub.advisor2Id),
      resolveLecturer(sub.preferredAdvisor1Id),
      resolveLecturer(sub.preferredAdvisor2Id),
      db.getSuratBySubmissionId(id).catch(() => null),
    ]);

    return {
      ...sub,
      options,
      logs,
      student,
      advisor1: adv1,
      advisor2: adv2,
      preferredAdvisor1: pref1,
      preferredAdvisor2: pref2,
      surat,
    };
  }

  /**
   * List submissions with optional filters.
   * Fully hydrates each row (options, logs, student, advisors, surat)
   * like getSubmissionById — web reports/dashboards need this data.
   */
  async listSubmissions(filter?: {
    status?: string;
    studentId?: string;
    advisorId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SubmissionDto[]> {
    const submissions = await db.listSubmissions(filter);

    return Promise.all(
      submissions.map(async (sub) => {
        const [options, logs, student, adv1, adv2, pref1, pref2, surat] = await Promise.all([
          db.getOptionsBySubmissionId(sub.id).catch(() => []),
          db.getApprovalLogsBySubmissionId(sub.id).catch(() => []),
          db.getUserProfileByUserId(sub.studentId).catch(() => null),
          resolveLecturer(sub.advisor1Id),
          resolveLecturer(sub.advisor2Id),
          resolveLecturer(sub.preferredAdvisor1Id),
          resolveLecturer(sub.preferredAdvisor2Id),
          db.getSuratBySubmissionId(sub.id).catch(() => null),
        ]);
        return {
          ...sub,
          options,
          logs,
          student,
          advisor1: adv1,
          advisor2: adv2,
          preferredAdvisor1: pref1,
          preferredAdvisor2: pref2,
          surat,
        };
      })
    );
  }

  /**
   * Rename a journal-file storage object to `refopt_<optionId>__<name>`
   * so repository listings can distinguish reference PDFs from thesis files.
   */
  private async tagReferenceJournalFile(fileId: string, optionId: string): Promise<void> {
    const file = await storageAdapter.getFileInfo('journals', fileId);
    const currentName = file?.name || fileId;
    if (currentName.startsWith('refopt_')) return;
    await storageAdapter.renameFile('journals', fileId, `refopt_${optionId}__${currentName}`);
  }
}

export const submissionService = new SubmissionService();
