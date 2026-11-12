import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/register', (req, res, next) => notificationController.register(req, res, next));
router.post('/unregister', (req, res, next) => notificationController.unregister(req, res, next));

export default router;
