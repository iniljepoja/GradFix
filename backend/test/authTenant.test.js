import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticate } from '../src/middleware/auth.js';
import { signAccessToken } from '../src/utils/tokens.js';

function reqFor({ token, tenantId }) {
  return {
    tenant: { id: tenantId },
    header(name) {
      return name === 'Authorization' ? `Bearer ${token}` : '';
    },
  };
}

test('tenant-bound user can authenticate within their tenant', () => {
  const token = signAccessToken({ id: 'user-1', role: 'tenant_admin', tenant_id: 'tenant-a' });
  const req = reqFor({ token, tenantId: 'tenant-a' });
  let nextArg;

  authenticate(req, {}, (err) => { nextArg = err; });

  assert.equal(nextArg, undefined);
  assert.deepEqual(req.user, { id: 'user-1', role: 'tenant_admin', tenantId: 'tenant-a' });
});

test('tenant-bound user cannot authenticate against another tenant', () => {
  const token = signAccessToken({ id: 'user-1', role: 'tenant_admin', tenant_id: 'tenant-a' });
  const req = reqFor({ token, tenantId: 'tenant-b' });
  let nextArg;

  authenticate(req, {}, (err) => { nextArg = err; });

  assert.equal(nextArg.status, 403);
  assert.equal(nextArg.code, 'FORBIDDEN');
  assert.equal(nextArg.message, 'User does not belong to this tenant');
});

test('super admin can authenticate across tenant context', () => {
  const token = signAccessToken({ id: 'super-1', role: 'super_admin', tenant_id: null });
  const req = reqFor({ token, tenantId: 'tenant-b' });
  let nextArg;

  authenticate(req, {}, (err) => { nextArg = err; });

  assert.equal(nextArg, undefined);
  assert.deepEqual(req.user, { id: 'super-1', role: 'super_admin', tenantId: null });
});
