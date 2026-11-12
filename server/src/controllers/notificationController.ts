import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { registerPushTarget, unregisterPushTarget } from '../services/notificationService';

export class NotificationController {
  /**
   * POST /api/notifications/register
   * Body: { token: string } — FCM device token dari expo-notifications.
   */
  async register(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = String(req.body?.token || '').trim();
      if (!token || token.length < 10 || token.length > 512) {
        res.status(400).json({
          success: false,
          error: 'FCM token tidak valid.',
        });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Autentikasi diperlukan.' });
        return;
      }

      const result = await registerPushTarget(userId, token);
      if (!result.ok) {
        res.status(502).json({
          success: false,
          error: `Gagal mendaftarkan perangkat: ${result.error}`,
        });
        return;
      }

      res.json({ success: true, data: { registered: true } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/notifications/unregister — hapus push target device ini.
   */
  async unregister(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Autentikasi diperlukan.' });
        return;
      }
      const ok = await unregisterPushTarget(userId);
      res.json({ success: true, data: { unregistered: ok } });
    } catch (err) {
      next(err);
    }
  }
}

export const notificationController = new NotificationController();
