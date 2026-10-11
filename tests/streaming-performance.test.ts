import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('streaming benchmark stays within the P4 regression budget', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/streaming-benchmark.ts'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const metrics = JSON.parse(result.stdout.trim());
  assert.equal(metrics.chunks, 10_000);
  assert.ok(metrics.bytes > 1_000_000);
  assert.ok(metrics.durationMs <= metrics.maxMs);
});
