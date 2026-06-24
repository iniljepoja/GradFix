import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENTITY_TYPES } from '../src/services/entity.service.js';

test('responsible entity types match managed vocabulary', () => {
  assert.deepEqual(ENTITY_TYPES, ['municipal_department', 'utility_company', 'contractor', 'ngo', 'other']);
});
