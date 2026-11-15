import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/login', authLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/oauth-session', authLimiter, (req, res, next) => authController.oauthSession(req, res, next));
router.post('/oauth/start', authLimiter, (req, res, next) => authController.oauthStart(req, res, next));
router.get('/oauth/status', (req, res, next) => authController.oauthStatus(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));
router.post('/logout', (req, res) => authController.logout(req, res));

export default router;
