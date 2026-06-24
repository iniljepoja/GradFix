import { api } from './client.js';

// Admin/staff report management. All routes are tenant-scoped and role-gated server-side.

export async function stats() {
  const { data } = await api.get('/admin/stats');
  return data.data;
}

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

export async function mergeDuplicate(id, canonicalId, note) {
  const { data } = await api.post(`/admin/reports/${id}/merge`, { canonicalId, note });
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

export async function listAssignmentHistory(id) {
  const { data } = await api.get(`/admin/reports/${id}/assignment-history`);
  return data.data;
}

export async function listWorkOrders(params = {}) {
  const { data } = await api.get('/admin/work-orders', { params });
  return { items: data.data, meta: data.meta };
}

export async function listReportWorkOrders(reportId) {
  const { data } = await api.get(`/admin/reports/${reportId}/work-orders`);
  return data.data;
}

export async function createWorkOrder(reportId, body = {}) {
  const { data } = await api.post(`/admin/reports/${reportId}/work-orders`, body);
  return data.data;
}

export async function changeWorkOrderStatus(id, body) {
  const { data } = await api.patch(`/admin/work-orders/${id}/status`, body);
  return data.data;
}

export async function listEntities() {
  const { data } = await api.get('/admin/entities');
  return data.data;
}

export async function createEntity(body) {
  const { data } = await api.post('/admin/entities', body);
  return data.data;
}

export async function updateEntity(id, body) {
  const { data } = await api.patch(`/admin/entities/${id}`, body);
  return data.data;
}

export async function listRoutes() {
  const { data } = await api.get('/admin/routes');
  return data.data;
}

export async function listPlatformTenants() {
  const { data } = await api.get('/admin/platform/tenants');
  return data.data;
}

export async function createPlatformTenant(body) {
  const { data } = await api.post('/admin/platform/tenants', body);
  return data.data;
}

export async function updatePlatformTenant(id, body) {
  const { data } = await api.patch(`/admin/platform/tenants/${id}`, body);
  return data.data;
}

export async function listPlatformReports(params = {}) {
  const { data } = await api.get('/admin/platform/reports', { params });
  return { items: data.data, meta: data.meta };
}

export async function listPlatformWorkOrders(params = {}) {
  const { data } = await api.get('/admin/platform/work-orders', { params });
  return { items: data.data, meta: data.meta };
}

export async function listPlatformEntities(params = {}) {
  const { data } = await api.get('/admin/platform/entities', { params });
  return data.data;
}

export async function listPlatformTenantAdmins(params = {}) {
  const { data } = await api.get('/admin/platform/tenant-admins', { params });
  return data.data;
}

export async function createPlatformTenantAdmin(body) {
  const { data } = await api.post('/admin/platform/tenant-admins', body);
  return data.data;
}
