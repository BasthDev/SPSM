import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * Determine default API URL:
 * In development on mobile, localhost refers to the device, so we resolve
 * debuggerHost / manifest hostUri if available, or fallback to localhost.
 */
function getDefaultApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:5000/api`;
  }

  return 'http://localhost:5000/api';
}

export const API_BASE_URL = getDefaultApiBaseUrl();

const TOKEN_KEY = 'spsm_auth_token';
let cachedAuthToken: string | null = null;

type ConnectionListener = (error: string | null) => void;
const connectionListeners: Set<ConnectionListener> = new Set();

export function onConnectionStatusChange(listener: ConnectionListener): () => void {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

export function notifyConnectionError(message: string = 'Tidak dapat terhubung ke server') {
  connectionListeners.forEach((listener) => {
    try {
      listener(message);
    } catch {}
  });
}

export function notifyConnectionSuccess() {
  connectionListeners.forEach((listener) => {
    try {
      listener(null);
    } catch {}
  });
}

export async function setAuthToken(token: string | null) {
  cachedAuthToken = token;
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // Ignore fallback if secure store is unavailable
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (cachedAuthToken) return cachedAuthToken;
  try {
    cachedAuthToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    // Ignore
  }
  return cachedAuthToken;
}

export class ApiError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    console.warn(`[apiClient] Network request failed for ${url}:`, netErr?.message);
    notifyConnectionError('Tidak dapat terhubung ke server');
    throw new ApiError(
      'Tidak dapat terhubung ke server. Pastikan backend server aktif dan perangkat terhubung ke jaringan.',
      503,
      { isNetworkError: true, original: netErr?.message }
    );
  }

  notifyConnectionSuccess();

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    // Respons non-JSON (mis. halaman error HTML Cloudflare Tunnel 1033,
    // maintenance page, dsb) — jangan tampilkan HTML mentah ke user.
    if (text.trimStart().startsWith('<')) {
      notifyConnectionError('Tidak dapat terhubung ke server');
      throw new ApiError(
        'Tidak dapat terhubung ke server. Coba beberapa saat lagi.',
        res.status || 503,
        { isGatewayError: true }
      );
    }
    json = { message: text };
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || `Request failed with status ${res.status}`;
    throw new ApiError(msg, res.status, json?.matches || json?.details);
  }

  return json?.data !== undefined ? json.data : json;
}

export const apiClient = {
  // --- Auth ---
  auth: {
    async login(email: string, pass: string) {
      const res = await request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });
      if (res?.token) {
        await setAuthToken(res.token);
      }
      return res;
    },
    async exchangeOAuthSession(userId: string, secret: string) {
      const res = await request<{ token: string; user: any }>('/auth/oauth-session', {
        method: 'POST',
        body: JSON.stringify({ userId, secret }),
      });
      if (res?.token) {
        await setAuthToken(res.token);
      }
      return res;
    },
    /** PocketBase OAuth2: mulai flow -> {url, key}. */
    async oauthStart(provider = 'google') {
      return request<{ url: string; key: string }>('/auth/oauth/start', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      });
    },
    /** Polling status OAuth -> {status, token?, user?, error?}. */
    async oauthStatus(key: string) {
      return request<{ status: string; token?: string; user?: any; error?: string }>(
        `/auth/oauth/status?key=${encodeURIComponent(key)}`
      );
    },
    /** Simpan token hasil OAuth ke secure store. */
    async completeOAuthToken(token: string) {
      await setAuthToken(token);
      return { token };
    },
    async getCurrentUser() {
      return request<any>('/auth/me');
    },
    async logout() {
      try {
        await request<any>('/auth/logout', { method: 'POST' });
      } finally {
        await setAuthToken(null);
      }
    },
  },

  // --- Submissions ---
  submissions: {
    async create(data: {
      studentId: string;
      options: any[];
      preferredAdvisor1Id?: string | null;
      preferredAdvisor2Id?: string | null;
    }) {
      return request<any>('/submissions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async resubmitRevision(id: string, data: {
      studentId: string;
      options: any[];
    }) {
      return request<any>(`/submissions/${id}/revision`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getById(id: string) {
      return request<any>(`/submissions/${id}`);
    },

    async list(filter?: { status?: string; studentId?: string; advisorId?: string }) {
      const params = new URLSearchParams();
      if (filter?.status) params.append('status', filter.status);
      if (filter?.studentId) params.append('studentId', filter.studentId);
      if (filter?.advisorId) params.append('advisorId', filter.advisorId);
      const query = params.toString() ? `?${params.toString()}` : '';
      return request<any[]>(`/submissions${query}`);
    },

    async updateStatus(
      id: string,
      status: string,
      actorId?: string,
      action?: string,
      notes?: string,
      patch?: any
    ) {
      return request<any>(`/submissions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, actorId, action, notes, patch }),
      });
    },

    async checkSimilarity(titles: string[]) {
      return request<any>('/submissions/check-similarity', {
        method: 'POST',
        body: JSON.stringify({ titles }),
      });
    },

    async getComparableTitles() {
      return request<string[]>('/submissions/comparable-titles');
    },
  },

  // --- Files / Storage ---
  files: {
    async upload(bucket: 'journals' | 'sk', file: any, fileName: string, mimeType = 'application/pdf') {
      const formData = new FormData();
      formData.append('bucket', bucket);
      formData.append('file', {
        uri: file.uri || file,
        name: fileName,
        type: mimeType,
      } as any);

      const url = `${API_BASE_URL}/files/upload`;
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
      } catch (netErr: any) {
        console.warn(`[apiClient] File upload failed for ${url}:`, netErr?.message);
        notifyConnectionError('Tidak dapat terhubung ke server');
        throw new ApiError(
          'Tidak dapat terhubung ke server. Pastikan backend server aktif.',
          503,
          { isNetworkError: true, original: netErr?.message }
        );
      }

      notifyConnectionSuccess();

      const json = await res.json();
      if (!res.ok) {
        throw new ApiError(json.error || 'Gagal mengunggah file', res.status);
      }
      return json.data;
    },

    async getViewUrl(bucket: 'journals' | 'sk', fileId: string): Promise<string> {
      if (!fileId) return '';
      try {
        const res = await request<any>(`/files/${bucket}/${fileId}/url`);
        if (res?.url) return res.url;
      } catch {
        // fall through to endpoint URL (302 redirect)
      }
      return `${API_BASE_URL}/files/${bucket}/${fileId}/view`;
    },

    async getDownloadUrl(bucket: 'journals' | 'sk', fileId: string): Promise<string> {
      if (!fileId) return '';
      try {
        const res = await request<any>(`/files/${bucket}/${fileId}/url`);
        if (res?.url) return res.url;
      } catch {
        // fall through to endpoint URL (302 redirect)
      }
      return `${API_BASE_URL}/files/${bucket}/${fileId}/download`;
    },

    async list(bucket: 'journals' | 'sk', search?: string) {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return request<any[]>(`/files/${bucket}${q}`);
    },

    async delete(bucket: 'journals' | 'sk', fileId: string) {
      return request<any>(`/files/${bucket}/${fileId}`, { method: 'DELETE' });
    },
  },

  // --- Lecturers ---
  lecturers: {
    async list(filter?: { activeOnly?: boolean; department?: string }) {
      const params = new URLSearchParams();
      if (filter?.activeOnly) params.append('activeOnly', 'true');
      if (filter?.department) params.append('department', filter.department);
      const query = params.toString() ? `?${params.toString()}` : '';
      return request<any[]>(`/lecturers${query}`);
    },
    async getById(id: string) {
      return request<any>(`/lecturers/${id}`);
    },
    async create(data: any) {
      return request<any>('/lecturers', { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id: string, patch: any) {
      return request<any>(`/lecturers/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    async delete(id: string) {
      return request<any>(`/lecturers/${id}`, { method: 'DELETE' });
    },
  },

  // --- Master Data: Departments & Batch Years ---
  departments: {
    async list() {
      return request<any[]>('/departments');
    },
    async create(data: any) {
      return request<any>('/departments', { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id: string, patch: any) {
      return request<any>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    async delete(id: string) {
      return request<any>(`/departments/${id}`, { method: 'DELETE' });
    },
  },

  batchYears: {
    async list() {
      return request<any[]>('/batch-years');
    },
    async create(data: any) {
      return request<any>('/batch-years', { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id: string, patch: any) {
      return request<any>(`/batch-years/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    async delete(id: string) {
      return request<any>(`/batch-years/${id}`, { method: 'DELETE' });
    },
  },

  // --- Settings ---
  settings: {
    async get() {
      return request<any>('/settings');
    },
    async update(patch: any) {
      return request<any>('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
    },
  },

  // --- Surat ---
  surat: {
    async getBySubmissionId(submissionId: string) {
      return request<any>(`/surat/${submissionId}`);
    },
    async generate(data: { submissionId: string; department?: string; batchYear?: string | number }) {
      return request<any>('/surat/generate', { method: 'POST', body: JSON.stringify(data) });
    },
    /** File SK dokumen hasil generate dari template (placeholder terisi). */
    async getSkFile(submissionId: string) {
      return request<{ url: string; name: string; reused: boolean }>(
        `/surat/${submissionId}/sk-file`
      );
    },
    async getTemplate() {
      return request<{ name: string; url: string | null }>('/sk-template');
    },
  },

  // --- Notifications (push via Appwrite Messaging/FCM) ---
  notifications: {
    async register(token: string) {
      return request<any>('/notifications/register', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    },
    async unregister() {
      return request<any>('/notifications/unregister', { method: 'POST' });
    },
  },

  // --- Users & Profiles ---
  users: {
    async getProfile(userId: string) {
      return request<any>(`/users/profile/${userId}`);
    },
    async updateProfile(userId: string, patch: any) {
      return request<any>(`/users/profile/${userId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    /** Upload foto profil (file) → disimpan di file field users.avatar, avatar_url diisi URL file. */
    async uploadAvatar(userId: string, asset: { uri: string; fileName?: string | null; mimeType?: string | null }) {
      const formData = new FormData();
      const ext = (asset.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
      formData.append('avatar', {
        uri: asset.uri,
        name: asset.fileName || `avatar-${Date.now()}.${ext}`,
        type: asset.mimeType || 'image/jpeg',
      } as any);

      const url = `${API_BASE_URL}/users/${userId}/avatar`;
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let res: Response;
      try {
        res = await fetch(url, { method: 'POST', headers, body: formData });
      } catch (netErr: any) {
        console.warn(`[apiClient] Avatar upload failed for ${url}:`, netErr?.message);
        notifyConnectionError('Tidak dapat terhubung ke server');
        throw new ApiError('Tidak dapat terhubung ke server.', 503, { isNetworkError: true });
      }
      notifyConnectionSuccess();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(json?.error || `Upload avatar gagal (${res.status})`, res.status);
      }
      return json?.data;
    },
    async list() {
      return request<any[]>('/users');
    },
  },
};
