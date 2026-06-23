import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertTransition, STATUS_TRANSITIONS } from '../src/services/report.service.js';

test('accepted reports cannot transition back to new', () => {
  assert.equal(STATUS_TRANSITIONS.accepted.includes('new'), false);
  assert.throws(
    () => assertTransition('accepted', 'new'),
    /Illegal status transition: accepted → new/,
  );
});
