import { storage, APPWRITE_CONFIG, Query } from '../lib/appwrite';
import type { Models } from 'appwrite';

export interface RepoFile {
  $id: string;
  name: string;
  sizeOriginal: number;
  $createdAt: string;
  mimeType?: string;
}

const PAGE_SIZE = 50;
const MAX_PAGES = 20;

/**
 * List all files in the journal_files bucket (paginated).
 * Owner prefix `owner_<userId>__` is preserved in `name`.
 */
export const storageService = {
  async listAllFiles(): Promise<RepoFile[]> {
    const files: RepoFile[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const queries = [Query.limit(PAGE_SIZE), Query.orderDesc('$createdAt')];
      if (cursor) queries.push(Query.cursorAfter(cursor));

      const res = await storage.listFiles(APPWRITE_CONFIG.storageBucketId, queries);
      const docs = res.files as unknown as Models.File[];
      if (docs.length === 0) break;

      files.push(
        ...docs.map((f) => ({
          $id: f.$id,
          name: f.name,
          sizeOriginal: f.sizeOriginal,
          $createdAt: f.$createdAt,
          mimeType: (f as unknown as { mimeType?: string }).mimeType,
        }))
      );

      if (docs.length < PAGE_SIZE) break;
      cursor = docs[docs.length - 1].$id;
    }

    return files;
  },

  getFileViewUrl(fileId: string): string {
    if (!fileId) return '#';
    try {
      return storage
        .getFileView(APPWRITE_CONFIG.storageBucketId, fileId)
        .toString();
    } catch {
      return '#';
    }
  },

  getFileDownloadUrl(fileId: string): string {
    if (!fileId) return '#';
    try {
      return storage
        .getFileDownload(APPWRITE_CONFIG.storageBucketId, fileId)
        .toString();
    } catch {
      return '#';
    }
  },
};
