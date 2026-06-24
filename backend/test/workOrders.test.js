import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertWorkOrderTransition, shouldResolveReportAfterCompletion, WORK_ORDER_TRANSITIONS,
} from '../src/services/work-order.service.js';

test('draft work orders can be sent or cancelled only', () => {
  assert.deepEqual(WORK_ORDER_TRANSITIONS.draft, ['sent', 'cancelled']);
  assert.doesNotThrow(() => assertWorkOrderTransition('draft', 'sent'));
  assert.doesNotThrow(() => assertWorkOrderTransition('draft', 'cancelled', 'Created by mistake'));
  assert.throws(
    () => assertWorkOrderTransition('draft', 'in_progress'),
    /Illegal work order transition: draft -> in_progress/,
  );
});

test('cancelling a work order requires a reason', () => {
  assert.throws(
    () => assertWorkOrderTransition('draft', 'cancelled'),
    /Cancellation reason is required/,
  );
});

test('terminal work order states cannot transition further', () => {
  for (const status of ['completed', 'cancelled', 'superseded']) {
    assert.deepEqual(WORK_ORDER_TRANSITIONS[status], []);
    assert.throws(
      () => assertWorkOrderTransition(status, 'sent'),
      new RegExp(`Illegal work order transition: ${status} -> sent`),
    );
  }
});

test('last completed active work order resolves an in-progress report', () => {
  assert.equal(shouldResolveReportAfterCompletion('in_progress', 0), true);
  assert.equal(shouldResolveReportAfterCompletion('in_progress', 1), false);
  assert.equal(shouldResolveReportAfterCompletion('assigned', 0), false);
  assert.equal(shouldResolveReportAfterCompletion('resolved', 0), false);
});
