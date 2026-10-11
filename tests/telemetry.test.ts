import test from 'node:test';
import assert from 'node:assert/strict';
import { createMoonexTelemetryEvent } from '../lib/telemetry.ts';

test('telemetry keeps safe operational fields and strips unknown providers', () => {
  const event = createMoonexTelemetryEvent({
    event: 'chat_attempt',
    durationMs: 1234.9,
    provider: 'openai',
    model: 'gpt-5.6-luna',
    moonexModel: 'moonex-fast-1.5',
    status: 200,
    reason: 'SUCCESS',
    retryable: false,
    fallbackCount: 2,
    confidence: 1.4,
  });

  assert.deepEqual(event, {
    event: 'chat_attempt',
    durationMs: 1234,
    provider: 'openai',
    model: 'gpt-5.6-luna',
    moonexModel: 'moonex-fast-1.5',
    status: 200,
    reason: 'SUCCESS',
    retryable: false,
    fallbackCount: 2,
    confidence: 1,
  });
});

test('telemetry never accepts arbitrary provider labels', () => {
  const event = createMoonexTelemetryEvent({
    event: 'chat_attempt',
    provider: 'secret-provider',
    model: 'model\nwith-log-injection',
    moonexModel: 'moonex-fast-1.5',
  });

  assert.equal(event.provider, undefined);
  assert.equal(event.model, undefined);
  assert.equal(event.moonexModel, 'moonex-fast-1.5');
});
