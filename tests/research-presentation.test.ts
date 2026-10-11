import assert from 'node:assert/strict';
import test from 'node:test';
import { getResearchStepState, normalizeResearchSources } from '../src/utils/researchPresentation.ts';

test('maps research pipeline status to step states', () => {
  assert.equal(getResearchStepState('planning', 'planning'), 'active');
  assert.equal(getResearchStepState('searching', 'planning'), 'complete');
  assert.equal(getResearchStepState('searching', 'searching'), 'active');
  assert.equal(getResearchStepState('synthesizing', 'searching'), 'complete');
  assert.equal(getResearchStepState('synthesizing', 'synthesizing'), 'active');
  assert.equal(getResearchStepState('completed', 'planning'), 'complete');
  assert.equal(getResearchStepState('completed', 'synthesizing'), 'complete');
  assert.equal(getResearchStepState('idle', 'searching'), 'pending');
});

test('normalizes research sources by trimming, filtering and deduplicating', () => {
  assert.deepEqual(
    normalizeResearchSources([
      { title: '  Example  ', url: ' HTTPS://Example.com/a ' },
      { title: 'Duplicate', url: 'https://example.com/a' },
      { title: '', url: 'https://example.com/b' },
      { title: 'Bad URL', url: 'javascript:alert(1)' },
      { title: 'Valid', url: 'https://example.com/c' },
    ]),
    [
      { title: 'Example', url: 'HTTPS://Example.com/a' },
      { title: 'Valid', url: 'https://example.com/c' },
    ],
  );
});
