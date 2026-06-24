import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTransition, requiresStartedWorkOrder, requiresStatusReason, STATUS_TRANSITIONS,
} from '../src/services/report.service.js';

test('accepted reports cannot transition back to new', () => {
  assert.equal(STATUS_TRANSITIONS.accepted.includes('new'), false);
  assert.throws(
    () => assertTransition('accepted', 'new'),
    /Illegal status transition: accepted → new/,
  );
});

test('closing a report requires a reason', () => {
  assert.equal(requiresStatusReason('in_progress', 'closed'), true);
  assert.throws(
    () => assertTransition('in_progress', 'closed'),
    /A reason is required for this status change/,
  );
  assert.doesNotThrow(() => assertTransition('in_progress', 'closed', 'Issue is invalid'));
});

test('reopening a resolved report requires a reason', () => {
  assert.equal(requiresStatusReason('resolved', 'in_progress'), true);
  assert.throws(
    () => assertTransition('resolved', 'in_progress'),
    /A reason is required for this status change/,
  );
  assert.doesNotThrow(() => assertTransition('resolved', 'in_progress', 'Repair failed'));
});

test('resolving a report does not require a reason', () => {
  assert.equal(requiresStatusReason('in_progress', 'resolved'), false);
  assert.doesNotThrow(() => assertTransition('in_progress', 'resolved'));
});

test('starting work requires an issued work order except for reopen', () => {
  assert.equal(requiresStartedWorkOrder('accepted', 'in_progress'), true);
  assert.equal(requiresStartedWorkOrder('assigned', 'in_progress'), true);
  assert.equal(requiresStartedWorkOrder('resolved', 'in_progress'), false);
});
