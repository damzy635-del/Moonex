import test from 'node:test';
import assert from 'node:assert/strict';
import { fitConversationContext } from '../lib/context-budget.ts';

test('keeps system messages and newest conversation messages', () => {
  const result = fitConversationContext([
    { role: 'user', content: 'old '.repeat(100) },
    { role: 'assistant', content: 'middle '.repeat(100) },
    { role: 'user', content: 'new '.repeat(100) },
  ], {
    maxInputTokens: 60,
    reservedOutputTokens: 20,
    systemMessages: [{ role: 'system', content: 'system instruction' }],
  });

  assert.equal(result.messages[0].role, 'system');
  assert.equal(result.messages.at(-1).content, 'new '.repeat(100));
  assert.equal(result.truncated, true);
  assert.ok(result.droppedMessages >= 1);
});

test('does not truncate when the conversation fits', () => {
  const messages = [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'world' },
  ];
  const result = fitConversationContext(messages, { maxInputTokens: 100 });

  assert.deepEqual(result.messages, messages);
  assert.equal(result.truncated, false);
  assert.equal(result.droppedMessages, 0);
});

test('preserves a single oversized newest message instead of dropping the active turn', () => {
  const newest = { role: 'user', content: 'x'.repeat(10_000) };
  const result = fitConversationContext([
    { role: 'user', content: 'old' },
    newest,
  ], { maxInputTokens: 10, reservedOutputTokens: 5 });

  assert.equal(result.messages.at(-1), newest);
  assert.equal(result.droppedMessages, 1);
  assert.equal(result.truncated, true);
});

test('handles invalid or zero budgets deterministically', () => {
  const result = fitConversationContext([
    { role: 'user', content: 'one' },
    { role: 'assistant', content: 'two' },
  ], { maxInputTokens: 0, reservedOutputTokens: 100 });

  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].content, 'two');
});
