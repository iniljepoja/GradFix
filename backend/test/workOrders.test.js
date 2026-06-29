import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertWorkOrderTransition, shouldResolveReportAfterCompletion, WORK_ORDER_TRANSITIONS,
  assertCanSendWorkOrder, SENDABLE_STATUSES,
} from '../src/services/work-order.service.js';
import { renderDocument } from '../src/services/work-order-document.service.js';
import { env } from '../src/config/env.js';

test('draft work orders can be sent, fail delivery, or be cancelled', () => {
  assert.deepEqual(WORK_ORDER_TRANSITIONS.draft, ['sent', 'delivery_failed', 'cancelled']);
  assert.doesNotThrow(() => assertWorkOrderTransition('draft', 'sent'));
  assert.doesNotThrow(() => assertWorkOrderTransition('draft', 'cancelled', 'Created by mistake'));
  assert.throws(
    () => assertWorkOrderTransition('draft', 'in_progress'),
    /Illegal work order transition: draft -> in_progress/,
  );
});

test('a draft work order can fail delivery (draft -> delivery_failed)', () => {
  assert.doesNotThrow(() => assertWorkOrderTransition('draft', 'delivery_failed'));
});

test('only draft or delivery_failed work orders may be sent', () => {
  assert.deepEqual(SENDABLE_STATUSES, ['draft', 'delivery_failed']);
  assert.doesNotThrow(() => assertCanSendWorkOrder('draft'));
  assert.doesNotThrow(() => assertCanSendWorkOrder('delivery_failed'));
  for (const status of ['sent', 'in_progress', 'completed', 'cancelled', 'superseded']) {
    assert.throws(
      () => assertCanSendWorkOrder(status),
      new RegExp(`Work order cannot be sent from "${status}"`),
    );
  }
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

test('work order PDFs embed report photos with report details', async (t) => {
  const storageKey = 'test-work-order-photo.jpg';
  const photoPath = path.resolve(env.uploadDir, storageKey);
  t.after(async () => { await rm(photoPath, { force: true }); });
  await mkdir(env.uploadDir, { recursive: true });
  await writeFile(photoPath, Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z',
    'base64',
  ));

  const pdf = await renderDocument({
    workOrderTitle: 'Repair broken bench',
    workOrderDescription: 'Replace damaged boards',
    status: 'draft',
    responsibleEntity: { name: 'City Utility', type: 'utility_company' },
    report: {
      title: 'Broken bench',
      categoryName: 'Urban furniture',
      priority: 'high',
      status: 'accepted',
      address: 'Main square',
      latitude: 46.1,
      longitude: 19.66,
      description: 'Bench is unsafe to use.',
      photos: [{ storageKey, url: `/uploads/${storageKey}` }],
    },
  });

  const pdfText = pdf.toString('latin1');
  assert.match(pdfText, /\/Subtype \/Image/);
});
