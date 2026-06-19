import { api } from './client.js';

// Admin/staff report management. All routes are tenant-scoped and role-gated server-side.

export async function listReports(params = {}) {
  const { data } = await api.get('/admin/reports', { params });
  return { items: data.data, meta: data.meta };
}

export async function getReport(id) {
  const { data } = await api.get(`/admin/reports/${id}`);
  return data.data;
}

export async function changeStatus(id, body) {
  const { data } = await api.patch(`/admin/reports/${id}/status`, body);
  return data.data;
}

export async function updatePriority(id, priority) {
  const { data } = await api.patch(`/admin/reports/${id}/priority`, { priority });
  return data.data;
}

// entityId omitted → backend falls back to the category's configured route.
export async function assign(id, entityId) {
  const { data } = await api.patch(`/admin/reports/${id}/assign`, entityId ? { entityId } : {});
  return data.data;
}

export async function listComments(id) {
  const { data } = await api.get(`/admin/reports/${id}/comments`);
  return data.data;
}

export async function addComment(id, body) {
  const { data } = await api.post(`/admin/reports/${id}/comments`, { body, isInternal: true });
  return data.data;
}

export async function listEntities() {
  const { data } = await api.get('/admin/entities');
  return data.data;
}

export async function listRoutes() {
  const { data } = await api.get('/admin/routes');
  return data.data;
}
