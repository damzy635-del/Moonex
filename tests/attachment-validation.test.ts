import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_ATTACHMENT_SIZE, isCodeFile, isImageFile, validateAttachment, validateAttachments } from '../src/utils/attachmentValidation.ts';

const file = (name: string, size: number, type: string) => ({ name, size, type });

test('accepts images, PDFs, text and supported code files', () => {
  assert.equal(validateAttachment(file('photo.png', 1000, 'image/png')), null);
  assert.equal(validateAttachment(file('report.pdf', 1000, 'application/pdf')), null);
  assert.equal(validateAttachment(file('notes.txt', 1000, 'text/plain')), null);
  assert.equal(validateAttachment(file('app.tsx', 1000, 'text/plain')), null);
});

test('rejects unsupported files and oversized files', () => {
  assert.equal(validateAttachment(file('archive.zip', 1000, 'application/zip')), 'Unsupported attachment type.');
  assert.equal(validateAttachment(file('large.pdf', MAX_ATTACHMENT_SIZE + 1, 'application/pdf')), 'File exceeds the 10 MB attachment limit.');
});

test('classifies image and code attachments', () => {
  assert.equal(isImageFile(file('x.webp', 1, 'image/webp')), true);
  assert.equal(isImageFile(file('x.txt', 1, 'text/plain')), false);
  assert.equal(isCodeFile('main.ts'), true);
  assert.equal(isCodeFile('photo.png'), false);
});

test('reports every invalid attachment in a batch', () => {
  assert.deepEqual(validateAttachments([
    file('ok.js', 10, 'text/plain'),
    file('bad.zip', 10, 'application/zip'),
    file('huge.pdf', MAX_ATTACHMENT_SIZE + 1, 'application/pdf'),
  ]), ['Unsupported attachment type.', 'File exceeds the 10 MB attachment limit.']);
});
