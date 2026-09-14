import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergePersistedConversations,
  normalizePersistedConversation,
  shouldPersistConversation,
} from '../src/utils/conversationPersistence.ts';
import type { Conversation } from '../src/types';

const conversation = (id: string, updatedAt: number, title = id): Conversation => ({
  id,
  title,
  messages: [],
  createdAt: updatedAt - 100,
  updatedAt,
  model: 'moonex-lite-1.5',
  thinkingLevel: 'none',
  enableWebSearch: false,
});

test('newer local conversation wins over stale cloud copy', () => {
  const result = mergePersistedConversations(
    [conversation('c1', 20, 'Local newer')],
    [conversation('c1', 10, 'Cloud older')],
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Local newer');
});

test('newer cloud conversation wins over stale local copy', () => {
  const result = mergePersistedConversations(
    [conversation('c1', 10, 'Local older')],
    [conversation('c1', 20, 'Cloud newer')],
  );

  assert.equal(result[0].title, 'Cloud newer');
});

test('merge preserves conversations that exist on only one side', () => {
  const result = mergePersistedConversations(
    [conversation('local', 30)],
    [conversation('cloud', 20)],
  );

  assert.deepEqual(result.map((item) => item.id), ['local', 'cloud']);
});

test('merge orders conversations by newest update', () => {
  const result = mergePersistedConversations(
    [conversation('old', 10), conversation('new', 40)],
    [conversation('middle', 20)],
  );

  assert.deepEqual(result.map((item) => item.id), ['new', 'middle', 'old']);
});

test('normalization maps legacy assistant model ids to the conversation model', () => {
  const result = normalizePersistedConversation({
    ...conversation('c1', 10),
    model: 'moonex-pro-2',
    messages: [{
      id: 'a1',
      role: 'assistant',
      content: 'answer',
      timestamp: 10,
      modelUsed: 'legacy-provider-model',
    }],
  });

  assert.equal(result.model, 'moonex-pro-2');
  assert.equal(result.messages[0].modelUsed, 'moonex-pro-2');
});

test('persistence only writes when the conversation has advanced', () => {
  const previous = conversation('c1', 20);
  assert.equal(shouldPersistConversation(previous, conversation('c1', 20)), false);
  assert.equal(shouldPersistConversation(previous, conversation('c1', 21)), true);
  assert.equal(shouldPersistConversation(undefined, conversation('c1', 1)), true);
});
