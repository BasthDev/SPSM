import { Request, Response, NextFunction } from 'express';
import { authService, AuthUser } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Akses ditolak: Token autentikasi tidak ditemukan.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'Sesi kedaluwarsa atau token tidak valid. Silakan login kembali.',
    });
    return;
  }
}

export function optionalAuthenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      req.user = authService.verifyToken(token);
    } catch {
      // Ignore if invalid in optional mode
    }
  }
  next();
}

/**
 * Require an authenticated user whose role is in the allowed set.
 * Users flagged `isAdmin` (or role 'admin') always pass.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Akses ditolak: autentikasi diperlukan.',
      });
      return;
    }
    const isAdmin = Boolean(req.user.isAdmin) || req.user.role === 'admin';
    if (isAdmin || roles.includes(req.user.role || '')) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      error: 'Akses ditolak: role Anda tidak memiliki izin untuk aksi ini.',
    });
  };
}
