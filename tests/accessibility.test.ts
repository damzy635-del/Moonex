import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getAriaLiveState, getAriaToggleState, getDialogA11yProps } from '../src/utils/accessibility';

test('toggle semantics expose role and pressed state', () => {
  assert.deepEqual(getAriaToggleState(true), { role: 'button', 'aria-pressed': true });
  assert.deepEqual(getAriaToggleState(false), { role: 'button', 'aria-pressed': false });
});

test('live-region semantics are atomic and polite by default', () => {
  assert.deepEqual(getAriaLiveState(), { 'aria-live': 'polite', 'aria-atomic': true });
  assert.deepEqual(getAriaLiveState('assertive'), { 'aria-live': 'assertive', 'aria-atomic': true });
});

test('dialog semantics identify modal content', () => {
  assert.deepEqual(getDialogA11yProps('research-dialog-title'), {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': 'research-dialog-title',
  });
});

test('global CSS preserves visible keyboard focus and reduced-motion behavior', () => {
  const css = fs.readFileSync('src/index.css', 'utf8');
  assert.match(css, /:focus-visible\s*\{/);
  assert.match(css, /prefers-reduced-motion/);
});

test('mobile interactive controls retain the 44px touch target contract', () => {
  const css = fs.readFileSync('src/index.css', 'utf8');
  assert.match(css, /\.moonex-mobile-touch\s*\{[^}]*min-width:\s*44px/);
  assert.match(css, /\.moonex-mobile-touch\s*\{[^}]*min-height:\s*44px/);
});
test('ChatInput integrates accessible labels, toggle state, live status, and touch targets', () => {
  const source = fs.readFileSync('src/components/ChatInput.tsx', 'utf8');
  assert.match(source, /getAriaToggleState\(enableThinking\)/);
  assert.match(source, /getAriaToggleState\(enableWebSearch\)/);
  assert.match(source, /aria-label="Message Moonex"/);
  assert.match(source, /getAriaLiveState\(\)/);
  assert.match(source, /aria-label="Attach images, PDFs, CSVs, or code files"/);
  assert.match(source, /aria-label=\{isListening \? "Stop voice dictation" : "Start voice dictation"\}/);
  assert.match(source, /moonex-mobile-touch/);
  assert.match(source, /id="chat-input-help"/);
});
