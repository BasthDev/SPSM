import { Client, Storage, ID, Query } from 'node-appwrite';
// @ts-ignore
import { InputFile } from 'node-appwrite/file';
import { config } from '../config';
import { IStorageAdapter, UploadedFileDto, StorageBucket } from './types';

export class AppwriteStorageAdapter implements IStorageAdapter {
  private client: Client;
  private storage: Storage;
  private buckets: typeof config.appwrite.buckets;

  constructor() {
    this.client = new Client()
      .setEndpoint(config.appwrite.endpoint)
      .setProject(config.appwrite.projectId)
      .setKey(config.appwrite.apiKey);

    this.storage = new Storage(this.client);
    this.buckets = config.appwrite.buckets;
  }

  private getBucketId(bucket: StorageBucket): string {
    return bucket === 'journals' ? this.buckets.journals : this.buckets.sk;
  }

  private mapFile(bucket: StorageBucket, f: any): UploadedFileDto {
    return {
      fileId: f.$id,
      id: f.$id,
      name: f.name,
      bucket,
      sizeOriginal: f.sizeOriginal,
      size: f.sizeOriginal,
      mimeType: f.mimeType,
      viewUrl: this.getFileViewUrl(bucket, f.$id),
      downloadUrl: this.getFileDownloadUrl(bucket, f.$id),
      createdAt: f.$createdAt,
    };
  }

  async uploadFile(
    bucket: StorageBucket,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<UploadedFileDto> {
    const bucketId = this.getBucketId(bucket);
    const fileId = ID.unique();
    const inputFile = InputFile.fromBuffer(fileBuffer, fileName);

    const uploaded = await this.storage.createFile(bucketId, fileId, inputFile);

    return this.mapFile(bucket, uploaded);
  }

  getFileViewUrl(bucket: StorageBucket, fileId: string): string {
    const bucketId = this.getBucketId(bucket);
    return `${config.appwrite.endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${config.appwrite.projectId}`;
  }

  getFileDownloadUrl(bucket: StorageBucket, fileId: string): string {
    const bucketId = this.getBucketId(bucket);
    return `${config.appwrite.endpoint}/storage/buckets/${bucketId}/files/${fileId}/download?project=${config.appwrite.projectId}`;
  }

  async getFileInfo(bucket: StorageBucket, fileId: string): Promise<{ name: string } | null> {
    try {
      const f = await this.storage.getFile(this.getBucketId(bucket), fileId);
      return { name: (f as any).name };
    } catch {
      return null;
    }
  }

  async renameFile(bucket: StorageBucket, fileId: string, newName: string): Promise<void> {
    await this.storage.updateFile(this.getBucketId(bucket), fileId, newName);
  }

  async deleteFile(bucket: StorageBucket, fileId: string): Promise<boolean> {
    const bucketId = this.getBucketId(bucket);
    await this.storage.deleteFile(bucketId, fileId);
    return true;
  }

  async listFiles(bucket: StorageBucket, search?: string): Promise<UploadedFileDto[]> {
    const bucketId = this.getBucketId(bucket);
    const queries: string[] = [Query.limit(100), Query.orderDesc('$createdAt')];
    if (search) {
      queries.push(Query.search('name', search));
    }
    const res = await this.storage.listFiles(bucketId, queries);
    let files = res.files;
    // When 'sk' shares the journals bucket physically, separate by filename prefix.
    if (bucket === 'sk') {
      files = files.filter((f: any) => String(f.name || '').startsWith('skscan_'));
    } else {
      files = files.filter((f: any) => {
        const n = String(f.name || '');
        return !n.startsWith('skscan_') && !n.startsWith('refopt_');
      });
    }
    return files.map((f: any) => this.mapFile(bucket, f));
  }
}
