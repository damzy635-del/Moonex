import assert from 'node:assert/strict';
import test from 'node:test';
import { completeStream, canPublishStreamState, stopStream } from '../src/utils/streamController.ts';
import { createStreamSession } from '../src/utils/streamSession.ts';

test('stopStream safely aborts an active session', () => {
  const session = createStreamSession();

  assert.equal(stopStream(session), true);
  assert.equal(session.controller.signal.aborted, true);
  assert.equal(stopStream(session), false);
});

test('completeStream is terminal and cannot race with stop', () => {
  const session = createStreamSession();

  assert.equal(completeStream(session), true);
  assert.equal(stopStream(session), false);
  assert.equal(session.state, 'completed');
});

test('null stream operations are safe', () => {
  assert.equal(stopStream(null), false);
  assert.equal(completeStream(null), false);
});

test('publish guard rejects stale sessions', () => {
  const first = createStreamSession();
  const second = createStreamSession(first.id);

  assert.equal(canPublishStreamState(first, second.id), false);
  assert.equal(canPublishStreamState(second, second.id), true);
});
