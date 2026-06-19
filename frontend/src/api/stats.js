import { api } from './client.js';

// Public dashboard statistics for the resolved tenant (no auth).
// Returns { total, resolvedPct, byStatus: [{ status, count }], byCategory: [{ categoryId, name, slug, count }] }.
export async function publicStats() {
  const { data } = await api.get('/stats');
  return data.data;
}
