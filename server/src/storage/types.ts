export type StorageBucket = 'journals' | 'sk';

export interface UploadedFileDto {
  fileId: string;
  id: string;
  name: string;
  bucket: StorageBucket;
  sizeOriginal: number;
  /** Legacy alias of sizeOriginal. */
  size?: number;
  mimeType: string;
  viewUrl: string;
  downloadUrl: string;
  createdAt?: string;
  /** Jenis file (mis. 'scan' | 'template' | 'generated' | 'file'). */
  kind?: string;
  /** Nomor record submission terkait (file SK hasil generate). */
  submissionId?: string;
}

/** Metadata opsional saat upload (PB-only fields). */
export interface UploadMeta {
  kind?: string;
  submissionId?: string;
}

export interface IStorageAdapter {
  uploadFile(
    bucket: StorageBucket,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    meta?: UploadMeta
  ): Promise<UploadedFileDto>;

  getFileViewUrl(bucket: StorageBucket, fileId: string): string;
  getFileDownloadUrl(bucket: StorageBucket, fileId: string): string;
  getFileInfo(bucket: StorageBucket, fileId: string): Promise<{ name: string } | null>;
  renameFile(bucket: StorageBucket, fileId: string, newName: string): Promise<void>;
  deleteFile(bucket: StorageBucket, fileId: string): Promise<boolean>;
  listFiles(bucket: StorageBucket, search?: string): Promise<UploadedFileDto[]>;
}
