import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, error: 'Email dan kata sandi wajib diisi.' });
        return;
      }

      const result = await authService.login(email, password);
      res.json({
        success: true,
        message: 'Login berhasil.',
        data: result,
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: err.message || 'Gagal masuk.',
      });
    }
  }

  async oauthSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, secret } = req.body;
      if (!userId || !secret) {
        res.status(400).json({ success: false, error: 'userId dan secret wajib disertakan.' });
        return;
      }

      const result = await authService.exchangeOAuthSession(userId, secret);
      res.json({
        success: true,
        message: 'Autentikasi OAuth berhasil.',
        data: result,
      });
    } catch (err: any) {
      res.status(err?.statusCode || 401).json({
        success: false,
        error: err.message || 'Gagal autentikasi OAuth.',
      });
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Tidak terotentikasi.' });
        return;
      }

      const user = await authService.resolveUserData(req.user.userId, req.user.email);
      res.json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'Berhasil keluar.',
    });
  }
}

export const authController = new AuthController();
