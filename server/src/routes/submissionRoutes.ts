import { Router } from 'express';
import { submissionController } from '../controllers/submissionController';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/authMiddleware';

const router = Router();

// All submission endpoints require authentication
router.use(authenticate);

router.post('/', (req, res, next) => submissionController.create(req, res, next));
router.post('/check-similarity', (req, res, next) => submissionController.checkSimilarity(req, res, next));
router.get('/comparable-titles', (req, res, next) => submissionController.comparableTitles(req, res, next));
router.get('/', (req, res, next) => submissionController.list(req, res, next));
router.get('/:id', (req, res, next) => submissionController.getById(req, res, next));
router.patch(
  '/:id',
  requireRole('admin', 'kaprodi', 'akademik', 'lecturer'),
  (req, res, next) => submissionController.updateSubmission(req, res, next)
);
router.patch(
  '/:id/status',
  requireRole('admin', 'kaprodi', 'akademik', 'lecturer'),
  (req, res, next) => submissionController.updateStatus(req, res, next)
);
router.get('/:id/options', (req, res, next) => submissionController.listOptions(req, res, next));
router.patch('/options/:optionId', requireRole('admin', 'kaprodi', 'akademik', 'lecturer'), (req, res, next) => submissionController.updateOption(req, res, next));
router.get('/:id/logs', (req, res, next) => submissionController.listLogs(req, res, next));
router.post('/:id/logs', requireRole('admin', 'kaprodi', 'akademik', 'lecturer'), (req, res, next) => submissionController.createLog(req, res, next));
router.post('/:id/revision', (req, res, next) => submissionController.resubmitRevision(req, res, next));

export default router;
