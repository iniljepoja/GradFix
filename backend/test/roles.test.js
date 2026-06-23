import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireCitizen } from '../src/middleware/auth.js';

function run(user) {
  let nextArg;
  requireCitizen({ user }, {}, (err) => { nextArg = err; });
  return nextArg;
}

test('requireCitizen allows citizen users', () => {
  assert.equal(run({ role: 'citizen' }), undefined);
});

test('requireCitizen rejects staff users', () => {
  const err = run({ role: 'tenant_admin' });
  assert.equal(err.status, 403);
  assert.equal(err.code, 'FORBIDDEN');
  assert.equal(err.message, 'Citizen account required');
});
