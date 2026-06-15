import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOpaqueToken, hashToken } from '../src/utils/tokens.js';

test('generateOpaqueToken returns a token and matching hash', () => {
  const { token, hash } = generateOpaqueToken();
  assert.equal(typeof token, 'string');
  assert.equal(token.length, 64); // 32 bytes hex
  assert.equal(hash, hashToken(token));
});

test('hashToken is deterministic and differs from the raw token', () => {
  const { token, hash } = generateOpaqueToken();
  assert.equal(hashToken(token), hash);
  assert.notEqual(token, hash);
});
