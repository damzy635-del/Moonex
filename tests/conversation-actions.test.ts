import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareMessageEdit, prepareMessageRegeneration } from '../src/utils/conversationActions.ts';
import type { FileAttachment, Message } from '../src/types';

const message = (id: string, role: Message['role'], content: string, files?: Message['files']): Message => ({
  id,
  role,
  content,
  timestamp: 1,
  files,
});

const attachment = (overrides: Partial<FileAttachment> = {}): FileAttachment => ({
  id: 'file-1',
  name: 'diagram.png',
  size: 1024,
  type: 'image',
  mimeType: 'image/png',
  data: 'base64',
  ...overrides,
});

test('edit uses the exact prefix before the target and preserves attachments', () => {
  const file = attachment();
  const messages = [
    message('u1', 'user', 'first'),
    message('a1', 'assistant', 'answer'),
    message('u2', 'user', 'old prompt', [file]),
    message('a2', 'assistant', 'old answer'),
  ];

  const result = prepareMessageEdit(messages, 'u2', 'edited prompt');

  assert.deepEqual(result?.messages.map((item) => item.id), ['u1', 'a1']);
  assert.deepEqual(result?.targetMessage, {
    ...messages[2],
    content: 'edited prompt',
  });
});

test('edit rejects an assistant message', () => {
  const result = prepareMessageEdit(
    [message('u1', 'user', 'prompt'), message('a1', 'assistant', 'answer')],
    'a1',
    'replacement',
  );
  assert.equal(result, null);
});

test('regeneration removes the latest assistant response without duplicating the user turn', () => {
  const file = attachment({
    id: 'file-2',
    name: 'file.txt',
    size: 3,
    type: 'document',
    mimeType: 'text/plain',
    data: 'abc',
  });
  const messages = [
    message('u1', 'user', 'first'),
    message('a1', 'assistant', 'answer 1'),
    message('u2', 'user', 'latest', [file]),
    message('a2', 'assistant', 'answer 2'),
  ];

  const result = prepareMessageRegeneration(messages);

  assert.deepEqual(result?.messages.map((item) => item.id), ['u1', 'a1']);
  assert.equal(result?.targetMessage?.id, 'u2');
  assert.equal(result?.targetMessage?.content, 'latest');
  assert.equal(result?.targetMessage?.files?.[0].name, 'file.txt');
});

test('regeneration is safe when there is no user turn', () => {
  assert.equal(prepareMessageRegeneration([message('a1', 'assistant', 'answer')]), null);
});
