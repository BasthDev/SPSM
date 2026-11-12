import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { masterDataService } from '../services/masterDataService';
import { db } from '../database';

export class MasterDataController {
  // --- Lecturers ---
  async listLecturers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const department = req.query.department ? String(req.query.department) : undefined;
      const data = await masterDataService.listLecturers({ activeOnly, department });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getLecturerById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.getLecturerById(req.params.id);
      if (!data) {
        res.status(404).json({ success: false, error: 'Dosen tidak ditemukan.' });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createLecturer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.createLecturer(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateLecturer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.updateLecturer(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteLecturer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await masterDataService.deleteLecturer(req.params.id);
      res.json({ success: true, message: 'Dosen berhasil dihapus.' });
    } catch (err) {
      next(err);
    }
  }

  // --- Departments ---
  async listDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.listDepartments();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.createDepartment(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.updateDepartment(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await masterDataService.deleteDepartment(req.params.id);
      res.json({ success: true, message: 'Program studi berhasil dihapus.' });
    } catch (err) {
      next(err);
    }
  }

  // --- Batch Years ---
  async listBatchYears(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.listBatchYears();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createBatchYear(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.createBatchYear(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateBatchYear(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.updateBatchYear(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteBatchYear(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await masterDataService.deleteBatchYear(req.params.id);
      res.json({ success: true, message: 'Tahun angkatan berhasil dihapus.' });
    } catch (err) {
      next(err);
    }
  }

  // --- System Settings ---
  async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.getSystemSettings();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.updateSystemSettings(req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // --- Surat ---
  async getSurat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await masterDataService.getSuratBySubmissionId(req.params.submissionId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async generateSurat(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { submissionId, department, batchYear } = req.body;
      const data = await masterDataService.generateSurat(submissionId, department, batchYear);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  // --- Users ---
  private isPrivilegedUser(req: AuthenticatedRequest): boolean {
    const u = req.user;
    if (!u) return false;
    return Boolean(u.isAdmin) || ['admin', 'kaprodi', 'akademik', 'lecturer', 'reviewer'].includes(u.role || '');
  }

  private canManageOthersProfile(req: AuthenticatedRequest): boolean {
    const u = req.user;
    if (!u) return false;
    return Boolean(u.isAdmin) || ['admin', 'kaprodi', 'akademik'].includes(u.role || '');
  }

  /** Normalize incoming profile payload (camelCase + common aliases) to UserProfileDto patch. */
  private normalizeProfilePatch(body: any): Record<string, any> {
    const patch: Record<string, any> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.email !== undefined) patch.email = body.email;
    const nim = body.nimOrNip ?? body.nim ?? body.nim_or_nip;
    if (nim !== undefined) {
      patch.nimOrNip = nim;
      patch.nim = nim;
    }
    if (body.department !== undefined) patch.department = body.department;
    const batchYear = body.batchYear ?? body.batch_year;
    if (batchYear !== undefined) patch.batchYear = batchYear;
    const currentSks = body.currentSks ?? body.current_sks;
    if (currentSks !== undefined) patch.currentSks = currentSks;
    const academicRequirements = body.academicRequirements ?? body.academic_requirements;
    if (academicRequirements !== undefined) patch.academicRequirements = academicRequirements;
    const avatarUrl = body.avatarUrl ?? body.avatar_url;
    if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl;
    const thesisFlag =
      body.thesisUploaded ?? body.hasUploadedThesis ?? body.has_uploaded_thesis;
    if (thesisFlag !== undefined) {
      patch.thesisUploaded = Boolean(thesisFlag);
      patch.hasUploadedThesis = Boolean(thesisFlag);
    }
    if (body.role !== undefined) patch.role = body.role;
    if (body.createdAt !== undefined) patch.createdAt = body.createdAt;
    const phone = body.phone ?? body.whatsapp ?? body.phone_number ?? body.phoneNumber;
    if (phone !== undefined) patch.phone = phone;
    return patch;
  }

  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.userId || req.user?.userId;
      if (!userId) {
        res.status(400).json({ success: false, error: 'User ID diperlukan.' });
        return;
      }
      // Authenticated users may read their own profile; privileged roles may read any.
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Autentikasi diperlukan.' });
        return;
      }
      const isSelf = req.user.userId === userId || req.user.id === userId;
      if (!isSelf && !this.isPrivilegedUser(req)) {
        res.status(403).json({ success: false, error: 'Akses ditolak.' });
        return;
      }
      let profile = await db.getUserProfileByUserId(userId);
      if (!profile) {
        // Fall back to document-id lookup (some clients pass the doc $id)
        profile = await db.getUserProfileById(userId);
      }
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.userId || req.user?.userId;
      if (!userId) {
        res.status(400).json({ success: false, error: 'User ID diperlukan.' });
        return;
      }
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Autentikasi diperlukan.' });
        return;
      }

      // Users may only edit their own profile unless admin/kaprodi/akademik
      const isSelf = req.user.userId === userId || req.user.id === userId;
      if (!isSelf && !this.canManageOthersProfile(req)) {
        res.status(403).json({ success: false, error: 'Anda tidak dapat mengubah profil pengguna lain.' });
        return;
      }

      const patch = this.normalizeProfilePatch(req.body || {});

      // Resolve existing profile by user_id first, then by document id
      // (mobile updateAvatarUrl historically passes the profile doc $id).
      let existing = await db.getUserProfileByUserId(userId);
      if (!existing) {
        existing = await db.getUserProfileById(userId);
      }

      if (!existing) {
        // UPSERT: create profile when none exists
        const email = patch.email || req.user.email || '';
        const nimOrNip =
          patch.nimOrNip ||
          patch.nim ||
          (email ? email.split('@')[0] : userId);
        const created = await db.createUserProfile({
          userId: req.user.userId || userId,
          name: patch.name || req.user.name || '',
          email,
          role: patch.role || req.user.role || 'student',
          nim: nimOrNip,
          nimOrNip,
          department: patch.department,
          batchYear: patch.batchYear,
          currentSks: patch.currentSks,
          academicRequirements: patch.academicRequirements,
          avatarUrl: patch.avatarUrl ?? null,
          phone: patch.phone,
          thesisUploaded: patch.thesisUploaded,
          hasUploadedThesis: patch.hasUploadedThesis,
          createdAt: new Date().toISOString(),
        } as any);
        res.json({ success: true, data: created });
        return;
      }

      const updated = await db.updateUserProfile(existing.id, patch);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : undefined;
      void offset; // offset not supported by adapter list; limit is applied
      const list = await db.listUsers(limit && !isNaN(limit) ? limit : 500);
      res.json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }
}

export const masterDataController = new MasterDataController();
