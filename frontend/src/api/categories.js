import { api } from './client.js';

// Active categories for the resolved tenant. Returns [{ id, name, slug, icon, sortOrder }].
export async function list() {
  const { data } = await api.get('/categories');
  return data.data;
}

// Active subcategories of a category. Returns [{ id, name, slug, sortOrder }].
export async function listSubcategories(categoryId) {
  const { data } = await api.get(`/categories/${categoryId}/subcategories`);
  return data.data;
}
