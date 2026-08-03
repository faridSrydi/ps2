// ============================================================
// PS2 Cloud Gaming Platform — API Service (Axios)
// Centralized HTTP client with auth token injection
// ============================================================

import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor: Inject JWT Token ───────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor: Handle 401 + Token Refresh ────
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Token expired → try refresh
    if (error.response?.status === 401 &&
        error.response?.data?.code === 'TOKEN_EXPIRED' &&
        !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });

        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed → logout
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error.response?.data || error);
  }
);

// ─── Auth API ────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  guest: () => api.post('/auth/guest'),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
};

// ─── Games API ───────────────────────────────────────────
export const gamesAPI = {
  list: (params) => api.get('/games', { params }),
  get: (id) => api.get(`/games/${id}`),
  search: (q) => api.get('/games/search', { params: { q } }),
  rescan: () => api.post('/games/rescan'),
};

// ─── Session API ─────────────────────────────────────────
export const sessionAPI = {
  create: (gameId) => api.post('/sessions', { gameId }),
  get: (id) => api.get(`/sessions/${id}`),
  pause: (id) => api.post(`/sessions/${id}/pause`),
  resume: (id) => api.post(`/sessions/${id}/resume`),
  screenshot: (id) => api.post(`/sessions/${id}/screenshot`),
  save: (id, slot) => api.post(`/sessions/${id}/save`, { slot }),
  destroy: (id) => api.delete(`/sessions/${id}`),
};

// ─── Favorites API ───────────────────────────────────────
export const favoritesAPI = {
  list: () => api.get('/favorites'),
  add: (gameId) => api.post('/favorites', { gameId }),
  remove: (gameId) => api.delete(`/favorites/${gameId}`),
};

// ─── Recently Played API ─────────────────────────────────
export const recentAPI = {
  list: () => api.get('/recent'),
};

// ─── Saves API ───────────────────────────────────────────
export const savesAPI = {
  list: (gameId) => api.get(`/saves/${gameId}`),
  delete: (id) => api.delete(`/saves/${id}`),
};

// ─── Profile API ─────────────────────────────────────────
export const profileAPI = {
  get: () => api.get('/profile'),
  update: (data) => api.put('/profile', data),
  uploadAvatar: (formData) => api.put('/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// ─── Admin API ───────────────────────────────────────────
export const adminAPI = {
  dashboard: () => api.get('/admin/dashboard'),
  listUsers: (params) => api.get('/admin/users', { params }),
  changeRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  listSessions: (params) => api.get('/admin/sessions', { params }),
  killSession: (id) => api.delete(`/admin/sessions/${id}`),
  monitoring: () => api.get('/admin/monitoring'),
  logs: (params) => api.get('/admin/logs', { params }),
};

// ─── Screenshots API ─────────────────────────────────────
export const screenshotsAPI = {
  list: () => api.get('/screenshots'),
  delete: (id) => api.delete(`/screenshots/${id}`),
};

export default api;
