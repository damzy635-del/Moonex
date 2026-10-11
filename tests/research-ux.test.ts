import assert from 'node:assert/strict';
import test from 'node:test';
import { getResearchStepState, normalizeResearchSources } from '../src/utils/researchPresentation.ts';

test('research lifecycle maps steps to pending, active, and complete', () => {
  assert.equal(getResearchStepState('idle', 'planning'), 'pending');
  assert.equal(getResearchStepState('planning', 'planning'), 'active');
  assert.equal(getResearchStepState('planning', 'searching'), 'pending');
  assert.equal(getResearchStepState('searching', 'planning'), 'complete');
  assert.equal(getResearchStepState('searching', 'searching'), 'active');
  assert.equal(getResearchStepState('synthesizing', 'planning'), 'complete');
  assert.equal(getResearchStepState('synthesizing', 'searching'), 'complete');
  assert.equal(getResearchStepState('synthesizing', 'synthesizing'), 'active');
  assert.equal(getResearchStepState('completed', 'synthesizing'), 'complete');
});

test('research source normalization trims, validates, and deduplicates sources', () => {
  assert.deepEqual(normalizeResearchSources([
    { title: '  Official Source  ', url: ' HTTPS://Example.com/a ' },
    { title: 'Duplicate', url: 'https://example.com/a' },
    { title: '', url: 'https://example.com/b' },
    { title: 'Invalid', url: 'javascript:alert(1)' },
    { title: 'Valid', url: 'https://example.com/c' },
  ]), [
    { title: 'Official Source', url: 'HTTPS://Example.com/a' },
    { title: 'Valid', url: 'https://example.com/c' },
  ]);
});
