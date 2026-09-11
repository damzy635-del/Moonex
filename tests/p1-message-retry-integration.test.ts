import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

test('P1.6 App wiring uses authoritative message snapshots', () => {
  assert.match(appSource, /prepareMessageEdit\(currentConversation\.messages, messageId, newContent\.trim\(\)\)/);
  assert.match(appSource, /prepareMessageRegeneration\(currentConversation\.messages\)/);
  assert.match(appSource, /prepareMessageRetry\(currentConversation\.messages\.slice\(0, errorIndex \+ 1\)\)/);
  assert.match(appSource, /baseMessages\?: Message\[\]/);
  assert.match(appSource, /const conversationMessages = baseMessages \?\? currentConversation\.messages/);
});

test('P1.6 edit, regenerate, and retry all resend from their prepared snapshot', () => {
  assert.equal(countOccurrences(appSource, 'mutation.messages,\n    );'), 0, 'snapshot must be passed as the fourth send argument, not as a standalone value');
  assert.equal(countOccurrences(appSource, 'undefined,\n      mutation.messages,\n    );'), 3);
  assert.match(appSource, /onRetry=\{handleRetryMessage\}/);
});

test('P1.6 retry targets the original user request and does not duplicate it', () => {
  assert.match(appSource, /mutation\.targetMessage\.content,\n      mutation\.targetMessage\.files \|\| \[\],\n      undefined,\n      mutation\.messages,/);
  assert.match(appSource, /const mutation = prepareMessageRetry\(currentConversation\.messages\.slice\(0, errorIndex \+ 1\)\)/);
});
