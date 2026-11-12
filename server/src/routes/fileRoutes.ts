import { Router } from 'express';
import multer from 'multer';
import { fileController } from '../controllers/fileController';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/authMiddleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

const router = Router();

// Upload requires authentication (any role)
router.post('/upload', authenticate, upload.single('file'), (req, res, next) =>
  fileController.upload(req, res, next)
);

// Reads are semi-public (repository is viewable); optional auth enriches context
router.use(optionalAuthenticate);
router.get('/:bucket', (req, res, next) => fileController.listFiles(req, res, next));
router.get('/:bucket/:id/url', (req, res) => fileController.getFileUrls(req, res));
router.get('/:bucket/:id/view', (req, res) => fileController.getViewUrl(req, res));
router.get('/:bucket/:id/download', (req, res) => fileController.getDownloadUrl(req, res));

// Delete requires staff-level role (admin or lecturer and above)
router.delete(
  '/:bucket/:id',
  authenticate,
  requireRole('admin', 'kaprodi', 'akademik', 'lecturer', 'reviewer'),
  (req, res, next) => fileController.deleteFile(req, res, next)
);

export default router;
