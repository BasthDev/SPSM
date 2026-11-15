import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { fileService, resolveBucket } from '../services/fileService';

function badBucket(res: Response): void {
  res.status(400).json({
    success: false,
    error: "Parameter bucket tidak valid. Gunakan 'journals' atau 'sk'.",
  });
}

export class FileController {
  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'File tidak ditemukan dalam request.' });
        return;
      }

      const bucket = resolveBucket(req.body.bucket) || 'journals';
      // kind='template'|'generated' khusus admin — file SK internal.
      const requestedKind = typeof req.body.kind === 'string' ? req.body.kind : undefined;
      const isAdmin = Boolean(req.user?.isAdmin) || req.user?.role === 'admin';
      let meta: { kind?: string } | undefined;
      if (requestedKind === 'template' || requestedKind === 'generated') {
        if (!isAdmin) {
          res.status(403).json({ success: false, error: 'Hanya admin yang dapat mengatur file template SK.' });
          return;
        }
        meta = { kind: requestedKind };
      } else if (requestedKind === 'scan') {
        meta = { kind: 'scan' };
      }
      const uploaded = await fileService.uploadFile(
        bucket,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        meta
      );

      res.status(201).json({
        success: true,
        message: 'File berhasil diunggah.',
        data: uploaded,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /files/:bucket/:id/view — 302 redirect to the direct Appwrite
   * storage view URL so clients can use it as <a href>/window.open/WebView.
   */
  async getViewUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const bucket = resolveBucket(req.params.bucket);
    if (!bucket) {
      badBucket(res);
      return;
    }
    const url = (await fileService.resolveFileUrl(bucket, req.params.id, 'inline'))
      || fileService.getViewUrl(bucket, req.params.id);
    if (!url) {
      res.status(404).json({ success: false, error: 'File tidak ditemukan.' });
      return;
    }
    res.redirect(302, url);
  }

  /**
   * GET /files/:bucket/:id/download — 302 redirect to Appwrite download URL.
   */
  async getDownloadUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const bucket = resolveBucket(req.params.bucket);
    if (!bucket) {
      badBucket(res);
      return;
    }
    const url = (await fileService.resolveFileUrl(bucket, req.params.id, 'attachment'))
      || fileService.getDownloadUrl(bucket, req.params.id);
    if (!url) {
      res.status(404).json({ success: false, error: 'File tidak ditemukan.' });
      return;
    }
    res.redirect(302, url);
  }

  /**
   * GET /files/:bucket/:id/url — JSON { url, downloadUrl } for clients
   * that need the raw storage URL string (e.g. mobile).
   */
  async getFileUrls(req: AuthenticatedRequest, res: Response): Promise<void> {
    const bucket = resolveBucket(req.params.bucket);
    if (!bucket) {
      badBucket(res);
      return;
    }
    const viewUrl = (await fileService.resolveFileUrl(bucket, req.params.id, 'inline'))
      || fileService.getViewUrl(bucket, req.params.id);
    const downloadUrl = (await fileService.resolveFileUrl(bucket, req.params.id, 'attachment'))
      || fileService.getDownloadUrl(bucket, req.params.id);
    res.json({
      success: true,
      data: {
        url: viewUrl,
        viewUrl,
        downloadUrl,
      },
    });
  }

  async listFiles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bucket = resolveBucket(req.params.bucket);
      if (!bucket) {
        badBucket(res);
        return;
      }
      const search = req.query.search ? String(req.query.search) : undefined;
      const files = await fileService.listFiles(bucket, search);
      res.json({ success: true, data: files });
    } catch (err) {
      next(err);
    }
  }

  async deleteFile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bucket = resolveBucket(req.params.bucket);
      if (!bucket) {
        badBucket(res);
        return;
      }
      const { id } = req.params;
      await fileService.deleteFile(bucket, id);
      res.json({ success: true, message: 'File berhasil dihapus.' });
    } catch (err) {
      next(err);
    }
  }
}

export const fileController = new FileController();
