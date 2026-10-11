import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requiredMoonexCapabilities,
  profileSupportsMoonexCapabilities,
  capabilityContractError,
} from '../lib/moonex-request-capabilities.js';

test('image attachments require vision', () => {
  assert.deepEqual(requiredMoonexCapabilities({
    messages: [{ files: [{ type: 'image', mimeType: 'image/png' }] }],
  }), ['vision']);
});

test('web search requires search', () => {
  assert.deepEqual(requiredMoonexCapabilities({ enableWebSearch: true }), ['search']);
});

test('thinking requires reasoning', () => {
  assert.deepEqual(requiredMoonexCapabilities({ thinkingLevel: 'high' }), ['reasoning']);
});

test('code attachments require tools', () => {
  assert.deepEqual(requiredMoonexCapabilities({
    messages: [{ files: [{ type: 'code', name: 'server.ts' }] }],
  }), ['tools']);
});

test('multiple request requirements are deduplicated', () => {
  assert.deepEqual(requiredMoonexCapabilities({
    enableWebSearch: true,
    thinkingLevel: 'medium',
    messages: [{ files: [{ type: 'image', mimeType: 'image/jpeg' }, { type: 'code', name: 'app.tsx' }] }],
  }), ['vision', 'search', 'reasoning', 'tools']);
});

test('profile capability matching is strict', () => {
  const vision = { requiredCapabilities: ['vision'] };
  assert.equal(profileSupportsMoonexCapabilities(vision, ['vision']), true);
  assert.equal(profileSupportsMoonexCapabilities(vision, ['search']), false);
  assert.equal(profileSupportsMoonexCapabilities(vision, ['vision', 'search']), false);
});

test('contract error exposes only capability metadata', () => {
  assert.deepEqual(capabilityContractError(['vision', 'vision', 'search']), {
    code: 'CAPABILITY_CONTRACT_VIOLATION',
    requiredCapabilities: ['vision', 'search'],
  });
});
