import assert from 'node:assert/strict';
import test from 'node:test';
import { canPublishStream, createStreamSession } from '../src/utils/streamSession.ts';

test('new session is active and can publish', () => {
  const session = createStreamSession();

  assert.equal(session.state, 'active');
  assert.equal(session.isActive(), true);
  assert.equal(canPublishStream(session, session.id), true);
  assert.equal(session.controller.signal.aborted, false);
});

test('abort is idempotent and blocks further publishing', () => {
  const session = createStreamSession();

  assert.equal(session.abort(), true);
  assert.equal(session.state, 'aborted');
  assert.equal(session.isActive(), false);
  assert.equal(session.controller.signal.aborted, true);
  assert.equal(canPublishStream(session, session.id), false);
  assert.equal(session.abort(), false);
  assert.equal(session.complete(), false);
});

test('completion is terminal and prevents later cancellation', () => {
  const session = createStreamSession();

  assert.equal(session.complete(), true);
  assert.equal(session.state, 'completed');
  assert.equal(session.isActive(), false);
  assert.equal(canPublishStream(session, session.id), false);
  assert.equal(session.abort(), false);
});

test('stale session cannot publish after a newer session starts', () => {
  const first = createStreamSession();
  const second = createStreamSession(first.id);

  assert.equal(first.id < second.id, true);
  assert.equal(canPublishStream(first, second.id), false);
  assert.equal(canPublishStream(second, first.id), false);
  assert.equal(canPublishStream(second, second.id), true);
});
