import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve(process.cwd(), 'src/index.css');
const css = fs.readFileSync(cssPath, 'utf8');

test('mobile layout uses dynamic viewport sizing', () => {
  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /-webkit-fill-available/);
});

test('mobile layout accounts for safe-area insets', () => {
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-right/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /safe-area-inset-left/);
  assert.match(css, /moonex-mobile-composer/);
});

test('mobile scrolling prevents accidental overscroll chaining', () => {
  assert.match(css, /overscroll-behavior-y:\s*contain/);
  assert.match(css, /scroll-padding-bottom/);
});

test('mobile composer controls reserve touch-friendly hit areas', () => {
  assert.match(css, /\.moonex-mobile-touch\s*\{[^}]*min-width:\s*44px/s);
  assert.match(css, /min-height:\s*44px/s);
});

test('composer textarea remains bounded on short mobile viewports', () => {
  assert.match(css, /#chat-textarea\s*\{[^}]*max-height:\s*min\(220px,\s*32dvh\)/s);
});
