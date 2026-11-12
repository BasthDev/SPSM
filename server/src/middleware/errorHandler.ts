import { Request, Response, NextFunction } from 'express';
import { SubmissionValidationError } from '../validators/submissionValidator';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[API Error]', err);

  if (err instanceof SubmissionValidationError) {
    res.status(err.statusCode || 422).json({
      success: false,
      error: err.message,
      matches: err.matches || [],
    });
    return;
  }

  // Multer errors (e.g. file too large) -> proper HTTP status
  if (err && err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({
      success: false,
      error:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran file melebihi batas maksimum (25 MB).'
          : `Upload gagal: ${err.message}`,
    });
    return;
  }

  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const message = err.message || 'Terjadi kesalahan internal pada server.';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}
