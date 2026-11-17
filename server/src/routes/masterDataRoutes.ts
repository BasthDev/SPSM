import { Router } from 'express';
import multer from 'multer';
import { masterDataController } from '../controllers/masterDataController';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/authMiddleware';

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max untuk foto profil
});

const router = Router();

// Public (optionally authenticated) reads for master data
router.use(optionalAuthenticate);

// Avatar upload — auth required, self only (dicek di controller)
router.post(
  '/users/:userId/avatar',
  authenticate,
  avatarUpload.single('avatar'),
  (req, res, next) => masterDataController.uploadAvatar(req, res, next)
);

// Lecturers — reads public, writes admin-only
router.get('/lecturers', (req, res, next) => masterDataController.listLecturers(req, res, next));
router.get('/lecturers/:id', (req, res, next) => masterDataController.getLecturerById(req, res, next));
router.post('/lecturers', authenticate, requireRole('admin'), (req, res, next) => masterDataController.createLecturer(req, res, next));
router.patch('/lecturers/:id', authenticate, requireRole('admin'), (req, res, next) => masterDataController.updateLecturer(req, res, next));
router.delete('/lecturers/:id', authenticate, requireRole('admin'), (req, res, next) => masterDataController.deleteLecturer(req, res, next));

// Departments — reads public, writes admin-only
router.get('/departments', (req, res, next) => masterDataController.listDepartments(req, res, next));
router.post('/departments', authenticate, requireRole('admin'), (req, res, next) => masterDataController.createDepartment(req, res, next));
router.patch('/departments/:id', authenticate, requireRole('admin'), (req, res, next) => masterDataController.updateDepartment(req, res, next));
router.delete('/departments/:id', authenticate, requireRole('admin'), (req, res, next) => masterDataController.deleteDepartment(req, res, next));

// Batch Years — reads public, writes admin-only
router.get('/batch-years', (req, res, next) => masterDataController.listBatchYears(req, res, next));
router.post('/batch-years', authenticate, requireRole('admin'), (req, res, next) => masterDataController.createBatchYear(req, res, next));
router.patch('/batch-years/:id', authenticate, requireRole('admin'), (req, res, next) => masterDataController.updateBatchYear(req, res, next));
router.delete('/batch-years/:id', authenticate, requireRole('admin'), (req, res, next) => masterDataController.deleteBatchYear(req, res, next));

// Settings — read public, write admin-only
router.get('/settings', (req, res, next) => masterDataController.getSettings(req, res, next));
router.patch('/settings', authenticate, requireRole('admin'), (req, res, next) => masterDataController.updateSettings(req, res, next));

// Surat — read public; generate is part of the academic status flow
router.get('/surat/:submissionId', (req, res, next) => masterDataController.getSurat(req, res, next));
router.post('/surat/generate', authenticate, requireRole('admin', 'kaprodi', 'akademik'), (req, res, next) => masterDataController.generateSurat(req, res, next));

// SK document dari template (placeholder terisi payload submission)
router.get('/surat/:submissionId/sk-file', authenticate, (req, res, next) => masterDataController.getSkFile(req, res, next));
router.get('/sk-template', (req, res, next) => masterDataController.getSkTemplate(req, res, next));

// Users & Profile
router.get('/users', authenticate, requireRole('admin'), (req, res, next) => masterDataController.listUsers(req, res, next));
router.get('/users/profile/:userId', authenticate, (req, res, next) => masterDataController.getProfile(req, res, next));
router.patch('/users/profile/:userId', authenticate, (req, res, next) => masterDataController.updateProfile(req, res, next));

export default router;
