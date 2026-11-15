import { storageAdapter, UploadedFileDto, StorageBucket, UploadMeta } from '../storage';

/**
 * Map client-facing bucket names to internal storage buckets.
 * - 'journals' | 'journal_files' | 'skripsi' -> journals (journal_files bucket)
 * - 'sk' | 'sk_files' | 'surat' -> sk (sk bucket; shares journal_files physically
 *   on plans with a single-bucket limit, distinguished by the 'skscan_' name prefix)
 */
export function resolveBucket(param: string | undefined | null): StorageBucket | null {
  if (!param) return null;
  const p = String(param).toLowerCase();
  if (p === 'journals' || p === 'journal_files' || p === 'skripsi' || p === 'journal') {
    return 'journals';
  }
  if (p === 'sk' || p === 'sk_files' || p === 'surat') {
    return 'sk';
  }
  return null;
}

export class FileService {
  async uploadFile(
    bucket: StorageBucket,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    meta?: UploadMeta
  ): Promise<UploadedFileDto> {
    const prefixedName = bucket === 'sk' && !fileName.startsWith('skscan_') && meta?.kind !== 'template' && meta?.kind !== 'generated'
      ? `skscan_${fileName}`
      : fileName;
    return storageAdapter.uploadFile(bucket, buffer, prefixedName, mimeType, meta);
  }

  getViewUrl(bucket: StorageBucket, fileId: string): string {
    return storageAdapter.getFileViewUrl(bucket, fileId);
  }

  getDownloadUrl(bucket: StorageBucket, fileId: string): string {
    return storageAdapter.getFileDownloadUrl(bucket, fileId);
  }

  async getFileInfo(bucket: StorageBucket, fileId: string): Promise<{ name: string } | null> {
    return storageAdapter.getFileInfo(bucket, fileId);
  }

  async renameFile(bucket: StorageBucket, fileId: string, newName: string): Promise<void> {
    return storageAdapter.renameFile(bucket, fileId, newName);
  }

  async deleteFile(bucket: StorageBucket, fileId: string): Promise<boolean> {
    return storageAdapter.deleteFile(bucket, fileId);
  }

  async listFiles(bucket: StorageBucket, search?: string): Promise<UploadedFileDto[]> {
    return storageAdapter.listFiles(bucket, search);
  }

  /** Resolve URL view/download yang sebenarnya (PB butuh lookup record async). */
  async resolveFileUrl(bucket: StorageBucket, fileId: string, disposition: 'inline' | 'attachment' = 'inline'): Promise<string | null> {
    const adapter = storageAdapter as any;
    if (typeof adapter.resolveFileUrl === 'function') {
      return adapter.resolveFileUrl(bucket, fileId, disposition);
    }
    return disposition === 'attachment'
      ? this.getDownloadUrl(bucket, fileId)
      : this.getViewUrl(bucket, fileId);
  }
}

export const fileService = new FileService();
