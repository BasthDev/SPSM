import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/oauth-session', (req, res, next) => authController.oauthSession(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));
router.post('/logout', (req, res) => authController.logout(req, res));

export default router;
