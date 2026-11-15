import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { submissionService } from '../services/submissionService';
import { SubmissionValidator } from '../validators/submissionValidator';
import { checkTitleSimilarityWithGemini } from '../validators/similarityChecker';
import { db } from '../database';
import { normalizeSubmissionStatus } from '../database/types';

export class SubmissionController {
  /**
   * POST /api/submissions
   * 1. Validator checks payload & Gemini AI title similarity against existing titles.
   * 2. If identical / high similarity, rejected with 422 error.
   * 3. Otherwise, creates submission and options.
   */
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Authenticated students always submit as themselves;
      // only admin may submit on behalf of another studentId.
      const isAdmin = Boolean(req.user?.isAdmin) || req.user?.role === 'admin';
      // Students always submit as themselves; admin may specify another studentId.
      const studentId = isAdmin
        ? (req.body.studentId || req.user?.userId)
        : req.user?.userId;
      const input = {
        ...req.body,
        studentId,
      };

      // 1. Validator Layer (Gemini similarity check)
      const { similarityReport } = await SubmissionValidator.validateAndCheckSimilarity(input);

      // 2. Process Layer
      const submission = await submissionService.createSubmission(input);

      res.status(201).json({
        success: true,
        message: 'Pengajuan skripsi berhasil dikirim.',
        data: submission,
        similarityReport,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/submissions/:id/revision
   */
  async resubmitRevision(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const input = {
        ...req.body,
        studentId: req.user?.userId || req.body.studentId,
      };

      // Validator Layer
      await SubmissionValidator.validateAndCheckSimilarity(input);

      // Process Layer (ownership + status guards inside service)
      const updated = await submissionService.resubmitRevision(id, input.options, {
        userId: req.user?.userId,
        role: req.user?.role,
        isAdmin: req.user?.isAdmin,
      });

      res.json({
        success: true,
        message: 'Revisi pengajuan skripsi berhasil dikirim.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/submissions/:id
   */
  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const submission = await submissionService.getSubmissionById(id);
      if (!submission) {
        res.status(404).json({ success: false, error: 'Pengajuan tidak ditemukan.' });
        return;
      }
      res.json({ success: true, data: submission });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/submissions
   */
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, studentId, advisorId, limit, offset } = req.query;
      const filter: any = {};
      if (status) filter.status = String(status);
      if (studentId) filter.studentId = String(studentId);
      if (advisorId) filter.advisorId = String(advisorId);
      if (limit) filter.limit = parseInt(String(limit), 10);
      if (offset) filter.offset = parseInt(String(offset), 10);

      // Students can only ever list their own submissions
      const role = req.user?.role;
      const isPrivileged =
        Boolean(req.user?.isAdmin) ||
        ['admin', 'kaprodi', 'akademik', 'lecturer', 'reviewer'].includes(role || '');
      if (!isPrivileged && req.user?.userId) {
        filter.studentId = req.user.userId;
      }

      const list = await submissionService.listSubmissions(filter);
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/submissions/:id/status
   */
  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, action, notes, patch } = req.body;
      const actorId = req.user?.userId || req.body.actorId || 'system';

      if (!status) {
        res.status(400).json({ success: false, error: 'Status baru wajib diisi.' });
        return;
      }

      if (!normalizeSubmissionStatus(status)) {
        res.status(400).json({ success: false, error: `Status tidak valid: ${status}` });
        return;
      }

      const updated = await submissionService.updateStatus(
        id,
        status,
        actorId,
        action || 'STATUS_UPDATE',
        notes,
        patch
      );

      res.json({ success: true, message: 'Status berhasil diperbarui.', data: updated });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/submissions/:id/options */
  async listOptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = await db.getOptionsBySubmissionId(req.params.id);
      res.json({ success: true, data: options });
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/submissions/options/:optionId — update opsi (mis. is_selected_by_lecturer). */
  async updateOption(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { optionId } = req.params;
      const { isSelected, isSelectedByLecturer, reviewNotes, lecturerNotes, title, background } = req.body || {};
      const patch: any = {};
      if (isSelected !== undefined) patch.isSelected = Boolean(isSelected);
      if (isSelectedByLecturer !== undefined) patch.isSelectedByLecturer = Boolean(isSelectedByLecturer);
      if (reviewNotes !== undefined) patch.reviewNotes = reviewNotes;
      if (lecturerNotes !== undefined) patch.lecturerNotes = lecturerNotes;
      if (title !== undefined) patch.title = title;
      if (background !== undefined) patch.background = background;
      const updated = await db.updateSubmissionOption(optionId, patch);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/submissions/:id/logs */
  async listLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = await db.getApprovalLogsBySubmissionId(req.params.id);
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/submissions/:id/logs — {actorId?, action, notes?} */
  async createLog(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, notes, actorId } = req.body || {};
      if (!action) {
        res.status(400).json({ success: false, error: 'action wajib diisi.' });
        return;
      }
      const log = await db.createApprovalLog({
        submissionId: req.params.id,
        actorId: actorId || req.user?.userId || 'system',
        action: String(action),
        notes: notes ?? undefined,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json({ success: true, data: log });
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/submissions/:id — update field umum (status, advisorId, notes). */
  async updateSubmission(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, advisorId, advisor1Id, advisor2Id, reviewerNotes, kaprodiNotes } = req.body || {};
      const patch: any = {};
      if (status !== undefined) {
        const norm = normalizeSubmissionStatus(status);
        if (!norm) {
          res.status(400).json({ success: false, error: `Status tidak valid: ${status}` });
          return;
        }
        patch.status = norm;
      }
      if (advisorId !== undefined) patch.advisorId = advisorId;
      if (advisor1Id !== undefined) patch.advisor1Id = advisor1Id;
      if (advisor2Id !== undefined) patch.advisor2Id = advisor2Id;
      if (reviewerNotes !== undefined) patch.reviewerNotes = reviewerNotes;
      if (kaprodiNotes !== undefined) patch.kaprodiNotes = kaprodiNotes;
      const updated = await db.updateSubmission(req.params.id, patch);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/submissions/comparable-titles
   * Returns deduped list of active titles for client-side similarity prefetch
   * (WITHOUT triggering Gemini).
   */
  async comparableTitles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await db.getAllActiveTitles();
      const titles = Array.from(new Set(items.map((i) => i.title)));
      res.json({ success: true, data: titles });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/submissions/check-similarity
   * Explicit check endpoint for pre-validation in UI
   */
  async checkSimilarity(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { titles } = req.body;
      if (!titles || !Array.isArray(titles) || titles.length === 0) {
        res.status(400).json({ success: false, error: 'Array titles wajib diisi.' });
        return;
      }

      const existingTitles = await db.getAllActiveTitles();
      const report = await checkTitleSimilarityWithGemini(titles, existingTitles);

      res.json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const submissionController = new SubmissionController();
