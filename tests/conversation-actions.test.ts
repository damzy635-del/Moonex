import { describe, expect, it } from 'vitest';
import { prepareMessageEdit, prepareMessageRegeneration } from '../src/utils/conversationActions';
import type { Message } from '../src/types';

const message = (id: string, role: Message['role'], content: string, files?: Message['files']): Message => ({
  id,
  role,
  content,
  timestamp: 1,
  files,
});

describe('conversation message mutations', () => {
  it('edit uses the exact prefix before the target and preserves attachments', () => {
    const attachment = { name: 'diagram.png', type: 'image', mimeType: 'image/png', data: 'base64' };
    const messages = [
      message('u1', 'user', 'first'),
      message('a1', 'assistant', 'answer'),
      message('u2', 'user', 'old prompt', [attachment]),
      message('a2', 'assistant', 'old answer'),
    ];

    const result = prepareMessageEdit(messages, 'u2', 'edited prompt');

    expect(result?.messages.map((item) => item.id)).toEqual(['u1', 'a1']);
    expect(result?.targetMessage).toMatchObject({
      id: 'u2',
      role: 'user',
      content: 'edited prompt',
      files: [attachment],
    });
  });

  it('rejects editing an assistant message', () => {
    const result = prepareMessageEdit(
      [message('u1', 'user', 'prompt'), message('a1', 'assistant', 'answer')],
      'a1',
      'replacement',
    );
    expect(result).toBeNull();
  });

  it('regeneration removes the latest assistant response without duplicating the user turn', () => {
    const messages = [
      message('u1', 'user', 'first'),
      message('a1', 'assistant', 'answer 1'),
      message('u2', 'user', 'latest', [{ name: 'file.txt', type: 'text', mimeType: 'text/plain', data: 'abc' }]),
      message('a2', 'assistant', 'answer 2'),
    ];

    const result = prepareMessageRegeneration(messages);

    expect(result?.messages.map((item) => item.id)).toEqual(['u1', 'a1']);
    expect(result?.targetMessage?.id).toBe('u2');
    expect(result?.targetMessage?.content).toBe('latest');
    expect(result?.targetMessage?.files?.[0].name).toBe('file.txt');
  });

  it('regeneration is safe when there is no user turn', () => {
    expect(prepareMessageRegeneration([message('a1', 'assistant', 'answer')])).toBeNull();
  });
});
