import { performance } from 'node:perf_hooks';

const CHUNK_COUNT = 10_000;
const CHUNK_SIZE = 256;
const MAX_MS = 500;

function buildSseChunk(index: number): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: `token-${index}-${'x'.repeat(CHUNK_SIZE - 16)}` } }] })}\\n\\n`;
}

const chunks = Array.from({ length: CHUNK_COUNT }, (_, index) => buildSseChunk(index));
let parsed = 0;
let bytes = 0;
const started = performance.now();

for (const chunk of chunks) {
  const lines = chunk.split(/\\r?\\n/);
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    const event = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
    parsed += event.choices?.[0]?.delta?.content?.length || 0;
    bytes += Buffer.byteLength(chunk, 'utf8');
  }
}

const durationMs = performance.now() - started;
const throughputMbPerSec = bytes / 1024 / 1024 / Math.max(durationMs / 1000, 0.001);
console.log(JSON.stringify({ chunks: CHUNK_COUNT, bytes, parsedCharacters: parsed, durationMs: Number(durationMs.toFixed(2)), throughputMbPerSec: Number(throughputMbPerSec.toFixed(2)), maxMs: MAX_MS }));
if (durationMs > MAX_MS) {
  throw new Error(`Streaming benchmark regression: ${durationMs.toFixed(2)}ms exceeds ${MAX_MS}ms`);
}
