import test from 'node:test';
import assert from 'node:assert/strict';
import { clearProviderHealth, recordProviderOutcome, providerHealth, rankProvidersWithHealth } from '../lib/provider-health.js';

test('provider health learns from outcomes and latency', () => {
  clearProviderHealth();
  recordProviderOutcome('provider-fast', { success: true, latencyMs: 200 });
  recordProviderOutcome('provider-slow', { success: false, latencyMs: 4_000 });

  const fast = providerHealth('provider-fast');
  const slow = providerHealth('provider-slow');
  assert.ok(fast.score > slow.score);
  assert.ok(fast.latencyMs < slow.latencyMs);
  assert.equal(slow.cooldown, true);
});

test('health-aware ranking deprioritizes a cooling-down provider', () => {
  clearProviderHealth();
  recordProviderOutcome('unhealthy', { success: false, latencyMs: 3_000 });
  recordProviderOutcome('healthy', { success: true, latencyMs: 250 });

  const ranked = rankProvidersWithHealth({}, [
    { id: 'unhealthy' },
    { id: 'healthy' },
  ]);
  assert.deepEqual(ranked.map((item) => item.id), ['healthy', 'unhealthy']);
});


test('provider health cache is bounded and removes expired inactive state', () => {
  clearProviderHealth();
  for (let index = 0; index < 32; index += 1) {
    recordProviderOutcome(`provider-${index}`, { success: true, latencyMs: 100 });
  }
  const retained = [];
  for (let index = 0; index < 32; index += 1) {
    retained.push(providerHealth(`provider-${index}`));
  }
  assert.ok(retained.filter((item) => item.samples > 0).length <= 16);
});
