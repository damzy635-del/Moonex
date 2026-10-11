import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareMessageRetry } from '../src/utils/conversationRetry.ts';
import type { Message } from '../src/types';

const message = (
  id: string,
  role: Message['role'],
  content: string,
  files?: Message['files'],
): Message => ({
  id,
  role,
  content,
  timestamp: 1,
  files,
});

test('retry removes the failed assistant response and preserves the exact user request', () => {
  const attachment = {
    id: 'f1',
    name: 'prompt.txt',
    size: 3,
    type: 'document' as const,
    mimeType: 'text/plain',
    data: 'abc',
  };

  const messages = [
    message('u1', 'user', 'older'),
    message('a1', 'assistant', 'older answer'),
    message('u2', 'user', 'retry this', [attachment]),
    { ...message('e2', 'assistant', 'temporary failure'), isError: true },
  ];

  const result = prepareMessageRetry(messages);

  assert.deepEqual(result?.messages.map((item) => item.id), ['u1', 'a1']);
  assert.equal(result?.targetMessage.id, 'u2');
  assert.equal(result?.targetMessage.content, 'retry this');
  assert.deepEqual(result?.targetMessage.files, [attachment]);
});

test('retry does not create a duplicate user turn', () => {
  const result = prepareMessageRetry([
    message('u1', 'user', 'request'),
    { ...message('e1', 'assistant', 'failed'), isError: true },
  ]);

  assert.deepEqual(result?.messages, []);
  assert.equal(result?.targetMessage.id, 'u1');
});

test('retry preserves only the history before the failed request', () => {
  const result = prepareMessageRetry([
    message('u1', 'user', 'first'),
    message('a1', 'assistant', 'answer'),
    message('u2', 'user', 'latest request'),
    { ...message('e2', 'assistant', 'failed'), isError: true },
  ]);

  assert.deepEqual(result?.messages.map((item) => item.id), ['u1', 'a1']);
  assert.equal(result?.targetMessage.id, 'u2');
});

test('retry safely rejects a conversation with no user request', () => {
  assert.equal(
    prepareMessageRetry([
      { ...message('e1', 'assistant', 'failed'), isError: true },
    ]),
    null,
  );
});
