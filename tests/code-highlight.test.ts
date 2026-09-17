import assert from 'node:assert/strict';
import test from 'node:test';
import { highlightCodeHtml, tokenizeCode } from '../src/utils/codeHighlight.ts';

test('tokenizes common code constructs', () => {
  const tokens = tokenizeCode('const total = 42; // total');
  assert.equal(tokens.some((token) => token.kind === 'keyword' && token.value === 'const'), true);
  assert.equal(tokens.some((token) => token.kind === 'number' && token.value === '42'), true);
  assert.equal(tokens.some((token) => token.kind === 'comment' && token.value.includes('// total')), true);
});

test('keeps strings intact and escapes HTML', () => {
  const html = highlightCodeHtml('const value = "<safe>";');
  assert.equal(html.includes('&lt;safe&gt;'), true);
  assert.equal(html.includes('moonex-code-string'), true);
  assert.equal(html.includes('<safe>'), false);
});
