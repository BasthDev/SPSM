const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://spsmapi.basthstudio.my.id/api';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('spsm_token');
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('spsm_token', token);
  } else {
    localStorage.removeItem('spsm_token');
  }
}

export class ApiError extends Error {
  public status: number;
  public details: any;

  constructor(message: string, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    const errorMsg = json?.error || json?.message || `Request failed (${res.status})`;
    throw new ApiError(errorMsg, res.status, json?.matches || json?.details);
  }

  return json?.data !== undefined ? json.data : json;
}

export const apiClient = {
  request,
  auth: {
    async login(email: string, pass: string) {
      const res = await request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      });
      if (res?.token) {
        setAuthToken(res.token);
      }
      return res;
    },
    async getCurrentUser() {
      try {
        return await request<any>('/auth/me');
      } catch {
        return null;
      }
    },
    async logout() {
      try {
        await request<any>('/auth/logout', { method: 'POST' });
      } finally {
        setAuthToken(null);
      }
    },
  },

  submissions: {
    async create(data: any) {
      return request<any>('/submissions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async resubmitRevision(id: string, data: any) {
      return request<any>(`/submissions/${id}/revision`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async getById(id: string) {
      return request<any>(`/submissions/${id}`);
    },
    async list(filter: any = {}) {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.studentId) params.append('studentId', filter.studentId);
      if (filter.advisorId) params.append('advisorId', filter.advisorId);
      const q = params.toString() ? `?${params.toString()}` : '';
      return request<any[]>(`/submissions${q}`);
    },
    async updateStatus(id: string, status: string, action = 'STATUS_UPDATE', notes = '', patch: any = null) {
      return request<any>(`/submissions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, action, notes, patch }),
      });
    },
    async update(id: string, patch: any) {
      return request<any>(`/submissions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    async getOptions(id: string) {
      return request<any[]>(`/submissions/${id}/options`);
    },
    async updateOption(optionId: string, patch: any) {
      return request<any>(`/submissions/options/${optionId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    async getLogs(id: string) {
      return request<any[]>(`/submissions/${id}/logs`);
    },
    async createLog(id: string, data: { actorId?: string; action: string; notes?: string }) {
      return request<any>(`/submissions/${id}/logs`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async comparableTitles() {
      return request<any[]>('/submissions/comparable-titles');
    },
  },

  files: {
    async upload(bucket: 'journals' | 'sk', file: File) {
      const formData = new FormData();
      formData.append('bucket', bucket);
      formData.append('file', file);

      const url = `${API_BASE_URL}/files/upload`;
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new ApiError(json.error || 'Gagal mengunggah file', res.status);
      }
      return json.data;
    },
    getViewUrl(bucket: 'journals' | 'sk', fileId: string) {
      return `${API_BASE_URL}/files/${bucket}/${fileId}/view`;
    },
    getDownloadUrl(bucket: 'journals' | 'sk', fileId: string) {
      return `${API_BASE_URL}/files/${bucket}/${fileId}/download`;
    },
    async list(bucket: 'journals' | 'sk', search?: string) {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return request<any[]>(`/files/${bucket}${q}`);
    },
    async remove(bucket: 'journals' | 'sk', fileId: string) {
      return request<any>(`/files/${bucket}/${fileId}`, { method: 'DELETE' });
    },
  },

  lecturers: {
    async list(filter: any = {}) {
      const params = new URLSearchParams();
      if (filter.activeOnly) params.append('activeOnly', 'true');
      if (filter.department) params.append('department', filter.department);
      const q = params.toString() ? `?${params.toString()}` : '';
      return request<any[]>(`/lecturers${q}`);
    },
    async getById(id: string) {
      return request<any>(`/lecturers/${id}`);
    },
    async create(data: any) {
      return request<any>('/lecturers', { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id: string, data: any) {
      return request<any>(`/lecturers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async remove(id: string) {
      return request<any>(`/lecturers/${id}`, { method: 'DELETE' });
    },
  },

  departments: {
    async list() {
      return request<any[]>('/departments');
    },
    async create(data: any) {
      return request<any>('/departments', { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id: string, data: any) {
      return request<any>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async remove(id: string) {
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
    async update(id: string, data: any) {
      return request<any>(`/batch-years/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async remove(id: string) {
      return request<any>(`/batch-years/${id}`, { method: 'DELETE' });
    },
  },

  users: {
    async list() {
      return request<any[]>('/users');
    },
    async getProfile(userId: string) {
      return request<any>(`/users/profile/${userId}`);
    },
    async updateProfile(userId: string, patch: any) {
      return request<any>(`/users/profile/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
  },

  settings: {
    async get() {
      return request<any>('/settings');
    },
    async update(patch: any) {
      return request<any>('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
    },
  },

  surat: {
    async getBySubmissionId(submissionId: string) {
      return request<any>(`/surat/${submissionId}`);
    },
    async generate(submissionId: string, department?: string, batchYear?: string | number) {
      return request<any>('/surat/generate', {
        method: 'POST',
        body: JSON.stringify({ submissionId, department, batchYear }),
      });
    },
  },
};
