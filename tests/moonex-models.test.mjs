import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_MODEL_ID,
  classifyMoonexTask,
  normalizeMoonexModelId,
  rankProviderModels,
  resolveMoonexProfile,
} from '../lib/moonex-models.js';

test('normalization rejects legacy/provider IDs from public model state', () => {
  assert.equal(normalizeMoonexModelId('gemini-3.7-flash'), 'moonex-lite-1.5');
  assert.equal(normalizeMoonexModelId('moonex-ultra-1.5'), 'moonex-ultra-1.5');
  assert.equal(normalizeMoonexModelId(AUTO_MODEL_ID), AUTO_MODEL_ID);
});

test('Auto routes arithmetic to Moonex Lite', () => {
  assert.equal(resolveMoonexProfile(AUTO_MODEL_ID, { messages: [{ role: 'user', content: "What's 12 × 47?" }] }).id, 'moonex-lite-1.5');
});

test('Auto routes coding work to Moonex Code', () => {
  assert.equal(resolveMoonexProfile(AUTO_MODEL_ID, { messages: [{ role: 'user', content: 'Write a React authentication system' }] }).id, 'moonex-code-1.5');
});

test('Auto routes algorithm analysis to a deeper Moonex profile', () => {
  assert.equal(resolveMoonexProfile(AUTO_MODEL_ID, { messages: [{ role: 'user', content: 'Analyze this complicated algorithm' }] }).id, 'moonex-reasoning-1.5');
});

test('Auto routes image attachments to Moonex Vision', () => {
  assert.equal(classifyMoonexTask({ messages: [{ role: 'user', content: 'Analyze this image', files: [{ mimeType: 'image/png', type: 'image' }] }] }).id, 'moonex-vision-1.5');
});

test('Auto routes current-information requests to Moonex Research', () => {
  assert.equal(resolveMoonexProfile(AUTO_MODEL_ID, { messages: [{ role: 'user', content: 'Research the latest information about renewable energy' }] }).id, 'moonex-research-1.5');
});

test('Provider ranking prefers semantic model matches over array position', () => {
  const profile = resolveMoonexProfile('moonex-code-1.5');
  const ranked = rankProviderModels(profile, [
    { id: 'unrelated-model', capabilities: { tools: true } },
    { id: 'codestral-latest', capabilities: { tools: true } },
    { id: 'another-model', capabilities: { tools: true } },
  ]);
  assert.equal(ranked[0].id, 'codestral-latest');
});

test('Research routing excludes models without search capability', () => {
  const profile = resolveMoonexProfile('moonex-research-1.5');
  const ranked = rankProviderModels(profile, [
    { id: 'gpt-5.6-sol', capabilities: { vision: true, reasoning: true, search: false } },
    { id: 'gemini-3.7-flash', capabilities: { vision: true, reasoning: true, search: true } },
  ]);
  assert.deepEqual(ranked.map((model) => model.id), ['gemini-3.7-flash']);
});

test('Vision routing excludes text-only models', () => {
  const profile = resolveMoonexProfile('moonex-vision-1.5');
  const ranked = rankProviderModels(profile, [
    { id: 'openai/gpt-oss-120b', capabilities: { reasoning: true, vision: false } },
    { id: 'gpt-5.6-sol', capabilities: { reasoning: true, vision: true } },
  ]);
  assert.deepEqual(ranked.map((model) => model.id), ['gpt-5.6-sol']);
});
