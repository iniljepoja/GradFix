import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
const tenantSlug = import.meta.env.VITE_TENANT_SLUG || 'zagreb';

// Single axios instance: injects the X-Tenant header and the Bearer access token,
// and transparently refreshes on 401. Components/hooks use this, never raw fetch.
export const api = axios.create({ baseURL });

let accessToken = null;
export function setAccessToken(token) { accessToken = token; }

export const tokenStore = {
  getRefresh: () => localStorage.getItem('gradfix.refresh'),
  setRefresh: (t) => localStorage.setItem('gradfix.refresh', t),
  clear: () => localStorage.removeItem('gradfix.refresh'),
};

api.interceptors.request.use((config) => {
  config.headers['X-Tenant'] = tenantSlug;
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && tokenStore.getRefresh()) {
      original._retry = true;
      try {
        refreshing ||= api.post('/auth/refresh', { refreshToken: tokenStore.getRefresh() });
        const { data } = await refreshing;
        refreshing = null;
        setAccessToken(data.data.accessToken);
        tokenStore.setRefresh(data.data.refreshToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (err) {
        refreshing = null;
        tokenStore.clear();
        throw err;
      }
    }
    throw error;
  },
);
