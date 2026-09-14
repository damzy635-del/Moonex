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
  const resendCalls = appSource.match(/handleSendMessage\(mutation\.targetMessage\.content, mutation\.targetMessage\.files \|\| \[\], undefined, mutation\.messages\)/g) || [];
  assert.equal(
    resendCalls.length,
    3,
    'edit, regenerate, and retry must each pass the prepared snapshot as the fourth send argument',
  );
  assert.equal(
    countOccurrences(appSource, 'handleSendMessage(mutation.targetMessage.content'),
    3,
    'all three message mutations must resend through handleSendMessage',
  );
  assert.match(appSource, /onRetry=\{handleRetryMessage\}/);
});

test('P1.6 retry targets the original user request and does not duplicate it', () => {
  assert.match(appSource, /mutation\.targetMessage\.content,\s*mutation\.targetMessage\.files \|\| \[\],\s*undefined,\s*mutation\.messages,/);
  assert.match(appSource, /const mutation = prepareMessageRetry\(currentConversation\.messages\.slice\(0, errorIndex \+ 1\)\)/);
});
