import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMoonexProfile, MOONEX_MODELS } from '../lib/moonex-models.js';

test('manual text profile with image escalates to Vision', () => {
  const profile = resolveMoonexProfile('moonex-lite-1.5', {
    messages: [{ files: [{ type: 'image', mimeType: 'image/png', name: 'photo.png' }] }],
  });
  assert.equal(profile.id, 'moonex-vision-1.5');
});

test('manual profile with web search escalates to Research', () => {
  const profile = resolveMoonexProfile('moonex-lite-1.5', { enableWebSearch: true });
  assert.equal(profile.id, 'moonex-research-1.5');
});

test('manual profile with thinking escalates to Reasoning', () => {
  const profile = resolveMoonexProfile('moonex-fast-1.5', { thinkingLevel: 'high' });
  assert.equal(profile.id, 'moonex-reasoning-1.5');
});

test('manual profile with code attachment escalates to Code', () => {
  const profile = resolveMoonexProfile('moonex-lite-1.5', {
    messages: [{ files: [{ type: 'code', name: 'app.tsx', mimeType: 'text/typescript' }] }],
  });
  assert.equal(profile.id, 'moonex-code-1.5');
});

test('live routing applies the context budget while preserving the newest turn', () => {
  const oldTurn = 'old context '.repeat(4_000);
  const activeTurn = 'active request '.repeat(2_000);
  const context = {
    messages: [
      { role: 'system', content: 'Preserve this system instruction.' },
      { role: 'user', content: oldTurn },
      { role: 'assistant', content: 'Old assistant response.' },
      { role: 'user', content: activeTurn },
    ],
  };

  const profile = resolveMoonexProfile('moonex-pro-1.5', context);

  assert.equal(profile.id, 'moonex-pro-1.5');
  assert.equal(context.messages[0].role, 'system');
  assert.equal(context.messages.at(-1).content, activeTurn);
  assert.equal(context.contextBudget.truncated, true);
  assert.ok(context.contextBudget.droppedMessages > 0);
});

test('capability routing does not create extra Moonex profiles', () => {
  assert.equal(MOONEX_MODELS.length, 9);
});
