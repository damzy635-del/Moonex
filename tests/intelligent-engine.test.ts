import test from 'node:test';
import assert from 'node:assert/strict';
import { clearProviderHealth, recordProviderOutcome } from '../lib/provider-health.js';
import { decideMoonexRoute, findMoonexModel, rankProviderModels } from '../lib/moonex-models.js';
import { routeProviders } from '../lib/intelligent-router.js';

test('auto router prefers research for explicit current-information intent', () => {
  const decision = decideMoonexRoute({ messages: [{ role: 'user', content: 'Find the latest 2026 information and cite your sources.' }] });
  assert.equal(decision.profile.id, 'moonex-research-1.5');
  assert.ok(decision.confidence >= 0.9);
});

test('auto router resolves ambiguous general prompts to a balanced profile', () => {
  const decision = decideMoonexRoute({ messages: [{ role: 'user', content: 'Can you help me make this better?' }] });
  assert.equal(decision.profile.id, 'moonex-pro-1.5');
});

test('capability constraints remain strict for vision and search', () => {
  const vision = decideMoonexRoute({ messages: [{ role: 'user', content: 'What is in this?', files: [{ type: 'image', mimeType: 'image/png' }] }] });
  assert.equal(vision.profile.id, 'moonex-vision-1.5');

  const research = decideMoonexRoute({ messages: [{ role: 'user', content: 'Search the web for this.' }], enableWebSearch: true });
  assert.equal(research.profile.id, 'moonex-research-1.5');
});

test('routing combines quality, health and latency signals', () => {
  clearProviderHealth();
  const profile = findMoonexModel('moonex-pro-1.5');
  recordProviderOutcome('openai', { success: false, latencyMs: 8_000, retryable: true, reason: 'UPSTREAM_UNAVAILABLE' });
  recordProviderOutcome('google', { success: true, latencyMs: 250 });

  const providers = [
    { id: 'gpt-5.6-terra', provider: 'openai' },
    { id: 'gemini-3.6-flash', provider: 'google' },
  ];
  const ranked = rankProviderModels(profile, providers);
  assert.equal(ranked[0].provider, 'google');
});

test('intelligent route exposes scored candidates without dropping compatible fallbacks', () => {
  clearProviderHealth();
  const profile = findMoonexModel('moonex-pro-1.5');
  const decision = routeProviders(profile, [
    { id: 'gpt-5.6-terra', provider: 'openai' },
    { id: 'gemini-3.6-flash', provider: 'google' },
    { id: 'mistral-medium-latest', provider: 'mistral' },
  ]);
  assert.ok(decision.selected);
  assert.equal(decision.candidates.length, 3);
  assert.ok((decision.selected?.routingScore || 0) >= 0);
});
