import { api } from './client.js';

// Public list (filters/sort/pagination). Returns { items, meta }.
export async function list(params = {}) {
  const { data } = await api.get('/reports', { params });
  return { items: data.data, meta: data.meta };
}

// The current user's report history. Returns { items, meta }.
export async function listMine(params = {}) {
  const { data } = await api.get('/reports/mine', { params });
  return { items: data.data, meta: data.meta };
}

export async function getById(id) {
  const { data } = await api.get(`/reports/${id}`);
  return data.data;
}

// Create a report with mandatory photos. `form` is a FormData (multipart).
export async function create(form) {
  const { data } = await api.post('/reports', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function upvote(id) {
  const { data } = await api.post(`/reports/${id}/upvote`);
  return data.data;
}

export async function removeUpvote(id) {
  const { data } = await api.delete(`/reports/${id}/upvote`);
  return data.data;
}

export async function rate(id, payload) {
  const { data } = await api.post(`/reports/${id}/rating`, payload);
  return data.data;
}

export async function history(id) {
  const { data } = await api.get(`/reports/${id}/history`);
  return data.data;
}
