import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/config/db.js';
import * as platform from '../src/services/platform.service.js';
import * as entities from '../src/services/entity.service.js';
import { ApiError } from '../src/utils/ApiError.js';

const SLUG_PREFIX = 'test-plat-';
const cleanupIds = [];

async function cleanup() {
  if (!cleanupIds.length) return;
  await query(`DELETE FROM users WHERE tenant_id = ANY($1::uuid[])`, [cleanupIds]);
  await query(`DELETE FROM responsible_entities WHERE tenant_id = ANY($1::uuid[])`, [cleanupIds]);
  await query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [cleanupIds]);
  cleanupIds.length = 0;
}

before(cleanup);
after(cleanup);

async function makeTenant(name = 'Test City', slug = `test-plat-${Date.now()}`) {
  const t = await platform.createTenant({ name, slug });
  cleanupIds.push(t.id);
  return t;
}

test('createTenant persists and listTenants returns it', async () => {
  const t = await makeTenant();
  const list = await platform.listTenants();
  const found = list.find((x) => x.id === t.id);
  assert.ok(found, 'created tenant should appear in listTenants');
  assert.equal(found.slug, t.slug);
  assert.equal(found.isActive, true);
});

test('updateTenant toggles isActive and renames', async () => {
  const t = await makeTenant();
  const suspended = await platform.updateTenant(t.id, { isActive: false });
  assert.equal(suspended.isActive, false);
  const renamed = await platform.updateTenant(t.id, { name: 'Renamed City' });
  assert.equal(renamed.name, 'Renamed City');
  assert.equal(renamed.isActive, false);
});

test('updateTenant throws notFound for unknown id', async () => {
  await assert.rejects(
    () => platform.updateTenant('11111111-1111-1111-1111-111111111111', { isActive: false }),
    (err) => err instanceof ApiError && err.status === 404,
  );
});

test('updateTenant throws badRequest when no fields supplied', async () => {
  const t = await makeTenant();
  await assert.rejects(
    () => platform.updateTenant(t.id, {}),
    (err) => err instanceof ApiError && err.status === 400,
  );
});

test('tenantStats reports counts scoped to the tenant', async () => {
  const t = await makeTenant('Stats City');
  await entities.createEntity(t.id, { name: 'Works Dept', type: 'municipal_department' });
  const stats = await platform.tenantStats(t.id);
  assert.equal(stats.responsibleEntities.total, 1);
  assert.equal(stats.responsibleEntities.active, 1);
  assert.equal(stats.reports.total, 0);
  assert.equal(stats.workOrders.total, 0);
});

test('tenantStats throws notFound for unknown tenant', async () => {
  await assert.rejects(
    () => platform.tenantStats('11111111-1111-1111-1111-111111111111'),
    (err) => err instanceof ApiError && err.status === 404,
  );
});

test('createEntity is isolated to the supplied tenant', async () => {
  const a = await makeTenant('Iso A');
  const b = await makeTenant('Iso B');
  const ent = await entities.createEntity(a.id, { name: 'A-only entity', type: 'ngo' });
  const aList = await entities.listEntities(a.id);
  const bList = await entities.listEntities(b.id);
  assert.equal(aList.find((e) => e.id === ent.id)?.name, 'A-only entity');
  assert.equal(bList.find((e) => e.id === ent.id), undefined, 'entity must not leak across tenants');
});

test('createTenantAdmin creates a verified tenant_admin scoped to the tenant', async () => {
  const t = await makeTenant('Admin City');
  const email = `admin-${Date.now()}@test.local`;
  const u = await platform.createTenantAdmin({ tenantId: t.id, email, password: 'Sup3rSecret!', fullName: 'Test Admin' });
  assert.equal(u.role, 'tenant_admin');
  assert.equal(u.tenantId, t.id);
  const listed = await platform.listTenantAdmins(t.id);
  assert.ok(listed.find((x) => x.id === u.id), 'created admin should appear in listTenantAdmins');
});

test('listTenantAdmins does not leak admins from other tenants when filtered', async () => {
  const a = await makeTenant('Admin A');
  const b = await makeTenant('Admin B');
  await platform.createTenantAdmin({ tenantId: a.id, email: `a-${Date.now()}@test.local`, password: 'Sup3rSecret!', fullName: 'A admin' });
  const aList = await platform.listTenantAdmins(a.id);
  const bList = await platform.listTenantAdmins(b.id);
  assert.equal(aList.length, 1);
  assert.equal(bList.length, 0, 'filtering by tenant A must not return tenant B admins');
});

test('listReports scopes by tenantId and includes tenantName', async () => {
  const t = await makeTenant('Reports City');
  const { items, total } = await platform.listReports({ tenantId: t.id });
  assert.equal(total, 0);
  assert.equal(items.length, 0);
  const all = await platform.listReports({});
  assert.ok(Array.isArray(all.items));
  for (const r of all.items) assert.ok(r.tenantName, 'cross-tenant list must include tenantName');
});

test('listWorkOrders scopes by tenantId and includes tenantName', async () => {
  const t = await makeTenant('WO City');
  const { items, total } = await platform.listWorkOrders({ tenantId: t.id });
  assert.equal(total, 0);
  assert.equal(items.length, 0);
  const all = await platform.listWorkOrders({});
  assert.ok(Array.isArray(all.items));
  for (const wo of all.items) assert.ok(wo.tenantName, 'cross-tenant list must include tenantName');
});
