import PocketBase from 'pocketbase';
import { config } from '../config';
import { IStorageAdapter, StorageBucket, UploadedFileDto, UploadMeta } from './types';

/**
 * PocketBase storage adapter.
 * Files disimpan sebagai record di collection `repo_files` (bucket journals)
 * dan `sk_files` (bucket sk — scan SK & template SK, dibedakan field `kind`).
 *
 * Catatan keamanan: viewRule kedua collection = null (public read) supaya URL
 * file bisa dipakai langsung tanpa token. Nama file PB tidak ditebak mudah;
 * create/update/delete tetap admin-only via backend.
 */
export class PocketBaseStorageAdapter implements IStorageAdapter {
  private pb: PocketBase;
  private baseUrl: string;

  constructor() {
    this.pb = new PocketBase(config.pocketbase.url);
    this.pb.autoCancellation(false);
    this.baseUrl = config.pocketbase.url.replace(/\/$/, '');
    void this.ensureAuth().catch(() => {});
  }

  private authPromise: Promise<void> | null = null;

  private async ensureAuth(): Promise<void> {
    const rec: any = this.pb.authStore.record;
    if (this.pb.authStore.isValid && rec?.collectionName === '_superusers') return;
    if (!this.authPromise) {
      this.authPromise = this.pb
        .admins.authWithPassword(config.pocketbase.adminEmail, config.pocketbase.adminPassword)
        .then(() => undefined)
        .finally(() => {
          this.authPromise = null;
        });
    }
    await this.authPromise;
  }

  private collectionFor(bucket: StorageBucket): string {
    return bucket === 'sk' ? 'sk_files' : 'repo_files';
  }

  private fileUrl(collection: string, recordId: string, fileName: string): string {
    return `${this.baseUrl}/api/files/${collection}/${recordId}/${encodeURIComponent(fileName)}`;
  }

  private recordFileName(record: any): string {
    const f = record?.file;
    if (Array.isArray(f)) return f[0] || '';
    return f || '';
  }

  private toDto(record: any, bucket: StorageBucket): UploadedFileDto {
    const collection = this.collectionFor(bucket);
    const fileName = this.recordFileName(record);
    const url = this.fileUrl(collection, record.id, fileName);
    const originalName = record.original_name || record.name || fileName;
    return {
      fileId: record.id,
      id: record.id,
      name: originalName,
      bucket,
      sizeOriginal: Number(record.size) || 0,
      size: Number(record.size) || 0,
      mimeType: record.mime || 'application/octet-stream',
      viewUrl: url,
      downloadUrl: url,
      createdAt: record.created,
      kind: record.kind || undefined,
      submissionId: record.submission_id || undefined,
    };
  }

  async uploadFile(
    bucket: StorageBucket,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    meta?: UploadMeta
  ): Promise<UploadedFileDto> {
    await this.ensureAuth();
    const collection = this.collectionFor(bucket);
    // Node 20+: File global tersedia — PB butuh filename asli via FormData.
    const file = new File([new Uint8Array(fileBuffer)], fileName, { type: mimeType });
    const record = await this.pb.collection(collection).create({
      name: fileName,
      original_name: fileName,
      size: fileBuffer.length,
      mime: mimeType,
      kind: meta?.kind || (bucket === 'sk' ? 'scan' : 'file'),
      ...(meta?.submissionId ? { submission_id: meta.submissionId } : {}),
      file,
    } as any);
    return this.toDto(record, bucket);
  }

  // Signature sync tidak tahu filename PB — gunakan resolveFileUrl (async)
  // dari controller. Method ini hanya fallback.
  getFileViewUrl(bucket: StorageBucket, fileId: string): string {
    return '';
  }

  getFileDownloadUrl(bucket: StorageBucket, fileId: string): string {
    return '';
  }

  /** Resolve URL file PB yang sebenarnya (butuh filename tersimpan di record). */
  async resolveFileUrl(bucket: StorageBucket, fileId: string, disposition: 'inline' | 'attachment' = 'inline'): Promise<string | null> {
    const record = await this.getRecord(bucket, fileId);
    if (!record) return null;
    const fileName = this.recordFileName(record);
    if (!fileName) return null;
    const base = this.fileUrl(this.collectionFor(bucket), record.id, fileName);
    return disposition === 'attachment' ? `${base}?download=1` : base;
  }

  async getFileInfo(bucket: StorageBucket, fileId: string): Promise<{ name: string } | null> {
    try {
      await this.ensureAuth();
      const record = await this.pb.collection(this.collectionFor(bucket)).getOne(fileId);
      return { name: record.original_name || record.name || '' };
    } catch {
      return null;
    }
  }

  async renameFile(bucket: StorageBucket, fileId: string, newName: string): Promise<void> {
    await this.ensureAuth();
    await this.pb.collection(this.collectionFor(bucket)).update(fileId, {
      name: newName,
      original_name: newName,
    });
  }

  async deleteFile(bucket: StorageBucket, fileId: string): Promise<boolean> {
    try {
      await this.ensureAuth();
      await this.pb.collection(this.collectionFor(bucket)).delete(fileId);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(bucket: StorageBucket, search?: string): Promise<UploadedFileDto[]> {
    await this.ensureAuth();
    const res = await this.pb.collection(this.collectionFor(bucket)).getList(1, 500, {
      ...(search ? { filter: `(name ~ "${search}" || original_name ~ "${search}")` } : {}),
      sort: '-created',
    });
    return res.items.map((r) => this.toDto(r, bucket));
  }

  /** Ambil record mentah — dipakai file proxy controller. */
  async getRecord(bucket: StorageBucket, fileId: string): Promise<any | null> {
    try {
      await this.ensureAuth();
      return await this.pb.collection(this.collectionFor(bucket)).getOne(fileId);
    } catch {
      return null;
    }
  }
}
