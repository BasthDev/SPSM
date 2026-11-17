/**
 * Universal API Client for SPSM Web App
 * Communicates with the Backend API Server (Node.js/Express)
 * No direct database calls to Appwrite!
 */

const API_BASE_URL =
  window.API_BASE_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://spsmapi.basthstudio.my.id/api');

export function getAuthToken() {
  return localStorage.getItem('spsm_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('spsm_token', token);
  } else {
    localStorage.removeItem('spsm_token');
  }
}

export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export function showConnectionErrorBanner(message = 'Tidak dapat terhubung ke server') {
  if (typeof document === 'undefined') return;
  let banner = document.getElementById('spsm-connection-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'spsm-connection-error-banner';
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #DC2626;
      color: #FFFFFF;
      padding: 10px 20px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px -5px rgba(220, 38, 38, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: system-ui, -apple-system, sans-serif;
      pointer-events: auto;
    `;
    banner.innerHTML = `
      <svg style="width:18px;height:18px;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      <span id="spsm-connection-error-text">${message}</span>
      <button id="spsm-connection-error-close" style="background:transparent;border:none;color:#fff;cursor:pointer;padding:0 0 0 6px;font-size:16px;line-height:1;opacity:0.8;">&times;</button>
    `;
    document.body.appendChild(banner);

    const closeBtn = document.getElementById('spsm-connection-error-close');
    if (closeBtn) {
      closeBtn.onclick = () => hideConnectionErrorBanner();
    }
  } else {
    const textEl = document.getElementById('spsm-connection-error-text');
    if (textEl) textEl.textContent = message;
    banner.style.display = 'flex';
    banner.style.opacity = '1';
    banner.style.transform = 'translateX(-50%) translateY(0)';
  }
}

export function hideConnectionErrorBanner() {
  if (typeof document === 'undefined') return;
  const banner = document.getElementById('spsm-connection-error-banner');
  if (banner) {
    banner.style.opacity = '0';
    banner.style.transform = 'translateX(-50%) translateY(-10px)';
    setTimeout(() => {
      banner.style.display = 'none';
    }, 300);
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr) {
    console.warn(`[apiClient] Network request failed for ${url}:`, netErr);
    showConnectionErrorBanner('Tidak dapat terhubung ke server');
    throw new ApiError('Tidak dapat terhubung ke server', 503, { isNetworkError: true, original: netErr });
  }

  hideConnectionErrorBanner();

  const text = await res.text();
  let json;
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
  // --- Auth ---
  auth: {
    async login(email, password) {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res?.token) {
        setAuthToken(res.token);
      }
      return res;
    },
    async oauthStart() {
      return await request('/auth/oauth/start', {
        method: 'POST',
        body: JSON.stringify({ provider: 'google' }),
      });
    },
    async oauthStatus(key) {
      return await request(`/auth/oauth/status?key=${encodeURIComponent(key)}`);
    },
    async exchangeOAuthSession(userId, secret) {
      const res = await request('/auth/oauth-session', {
        method: 'POST',
        body: JSON.stringify({ userId, secret }),
      });
      if (res?.token) {
        setAuthToken(res.token);
      }
      return res;
    },
    async getCurrentUser() {
      try {
        return await request('/auth/me');
      } catch {
        return null;
      }
    },
    async logout() {
      try {
        await request('/auth/logout', { method: 'POST' });
      } finally {
        setAuthToken(null);
      }
    },
  },

  // --- Submissions ---
  submissions: {
    async create(data) {
      return request('/submissions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async resubmitRevision(id, data) {
      return request(`/submissions/${id}/revision`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getById(id) {
      return request(`/submissions/${id}`);
    },

    async list(filter = {}) {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.studentId) params.append('studentId', filter.studentId);
      if (filter.advisorId) params.append('advisorId', filter.advisorId);
      const q = params.toString() ? `?${params.toString()}` : '';
      return request(`/submissions${q}`);
    },

    async updateStatus(id, status, action = 'STATUS_UPDATE', notes = '', patch = null) {
      return request(`/submissions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, action, notes, patch }),
      });
    },

    async checkSimilarity(titles) {
      return request('/submissions/check-similarity', {
        method: 'POST',
        body: JSON.stringify({ titles }),
      });
    },
  },

  // --- Storage / Files ---
  files: {
    async upload(bucket, file, fileName) {
      const formData = new FormData();
      formData.append('bucket', bucket);
      formData.append('file', file, fileName || file.name);

      const url = `${API_BASE_URL}/files/upload`;
      const token = getAuthToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        });
      } catch (netErr) {
        console.warn(`[apiClient] Upload failed for ${url}:`, netErr);
        showConnectionErrorBanner('Tidak dapat terhubung ke server');
        throw new ApiError('Tidak dapat terhubung ke server', 503, { isNetworkError: true, original: netErr });
      }

      hideConnectionErrorBanner();

      const json = await res.json();
      if (!res.ok) {
        throw new ApiError(json.error || 'Gagal mengunggah file', res.status);
      }
      return json.data;
    },

    getViewUrl(bucket, fileId) {
      return `${API_BASE_URL}/files/${bucket}/${fileId}/view`;
    },

    getDownloadUrl(bucket, fileId) {
      return `${API_BASE_URL}/files/${bucket}/${fileId}/download`;
    },

    async list(bucket, search) {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return request(`/files/${bucket}${q}`);
    },

    async delete(bucket, fileId) {
      return request(`/files/${bucket}/${fileId}`, { method: 'DELETE' });
    },
  },

  // --- Lecturers ---
  lecturers: {
    async list(filter = {}) {
      const params = new URLSearchParams();
      if (filter.activeOnly) params.append('activeOnly', 'true');
      if (filter.department) params.append('department', filter.department);
      const q = params.toString() ? `?${params.toString()}` : '';
      return request(`/lecturers${q}`);
    },
    async getById(id) {
      return request(`/lecturers/${id}`);
    },
    async create(data) {
      return request('/lecturers', { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id, patch) {
      return request(`/lecturers/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    async delete(id) {
      return request(`/lecturers/${id}`, { method: 'DELETE' });
    },
  },

  // --- Departments & Batch Years ---
  departments: {
    async list() {
      return request('/departments');
    },
    async create(data) {
      return request('/departments', { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id, patch) {
      return request(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    async delete(id) {
      return request(`/departments/${id}`, { method: 'DELETE' });
    },
  },

  batchYears: {
    async list() {
      return request('/batch-years');
    },
    async create(data) {
      return request('/batch-years', { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id, patch) {
      return request(`/batch-years/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    },
    async delete(id) {
      return request(`/batch-years/${id}`, { method: 'DELETE' });
    },
  },

  // --- Settings ---
  settings: {
    async get() {
      return request('/settings');
    },
    async update(patch) {
      return request('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
    },
  },

  // --- Surat ---
  surat: {
    async getBySubmissionId(submissionId) {
      return request(`/surat/${submissionId}`);
    },
    async generate(submissionId, department, batchYear) {
      return request('/surat/generate', {
        method: 'POST',
        body: JSON.stringify({ submissionId, department, batchYear }),
      });
    },
  },

  // --- Users & Profiles ---
  users: {
    async getProfile(userId) {
      return request(`/users/profile/${userId}`);
    },
    async updateProfile(userId, patch) {
      return request(`/users/profile/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    async list() {
      return request('/users');
    },
  },
};
