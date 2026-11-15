import { apiClient } from './apiClient';

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
 * List semua file di bucket 'journals' (repo) via backend API.
 * Nama file `owner_<userId>__` / `refopt_<optionId>__` dipertahankan.
 */
export const storageService = {
  async listAllFiles(): Promise<RepoFile[]> {
    const files: RepoFile[] = [];
    try {
      const list = await apiClient.files.list('journals');
      return (list || []).map((f: any) => ({
        $id: f.$id || f.id || f.fileId,
        name: f.name || f.originalName || f.$id || f.id,
        sizeOriginal: f.sizeOriginal ?? f.size ?? 0,
        $createdAt: f.$createdAt || f.createdAt || '',
        mimeType: f.mimeType,
      }));
    } catch (err) {
      console.error('Error listing repo files:', err);
      return files;
    }
  },

  getFileViewUrl(fileId: string): string {
    if (!fileId) return '#';
    return apiClient.files.getViewUrl('journals', fileId);
  },

  getFileDownloadUrl(fileId: string): string {
    if (!fileId) return '#';
    return apiClient.files.getDownloadUrl('journals', fileId);
  },

  /** SK/surat bucket */
  getSkFileViewUrl(fileId: string): string {
    if (!fileId) return '#';
    return apiClient.files.getViewUrl('sk', fileId);
  },

  getSkFileDownloadUrl(fileId: string): string {
    if (!fileId) return '#';
    return apiClient.files.getDownloadUrl('sk', fileId);
  },
};
