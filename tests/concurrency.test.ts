import test from 'node:test';
import assert from 'node:assert/strict';
import { clearConcurrency, concurrencyState, releaseConcurrency, tryAcquireConcurrency } from '../lib/concurrency.js';

test('concurrency admission allows requests up to the configured limit', () => {
  clearConcurrency();
  const { limit } = concurrencyState();
  let acquired = 0;
  for (let index = 0; index < limit; index += 1) acquired += Number(tryAcquireConcurrency());
  assert.equal(acquired, limit);
  assert.equal(tryAcquireConcurrency(), false);
  assert.equal(concurrencyState().active, limit);
  clearConcurrency();
});

test('concurrency release restores capacity after completion or cancellation', () => {
  clearConcurrency();
  const { limit } = concurrencyState();
  assert.equal(tryAcquireConcurrency(), true);
  assert.equal(concurrencyState().active, 1);
  releaseConcurrency();
  assert.equal(concurrencyState().active, 0);
  for (let index = 0; index < limit; index += 1) assert.equal(tryAcquireConcurrency(), true);
  releaseConcurrency();
  assert.equal(tryAcquireConcurrency(), true);
  clearConcurrency();
});
