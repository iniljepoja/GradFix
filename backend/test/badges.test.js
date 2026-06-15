import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeForCount } from '../src/utils/badges.js';

test('no badge below the first threshold', () => {
  const r = badgeForCount(0);
  assert.equal(r.badge, null);
  assert.deepEqual(r.nextBadge, { rank: 1, title: 'New Fellow Citizen', at: 1 });
});

test('awards the highest earned badge and the next target', () => {
  const r = badgeForCount(7);
  assert.deepEqual(r.badge, { rank: 2, title: 'Active Citizen' });
  assert.equal(r.nextBadge.at, 15);
  assert.equal(r.reportCount, 7);
});

test('tops out at the final rank with no next badge', () => {
  const r = badgeForCount(120);
  assert.deepEqual(r.badge, { rank: 6, title: 'City Lover' });
  assert.equal(r.nextBadge, null);
});
