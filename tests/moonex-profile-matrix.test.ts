import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat';

const profiles = [
  'moonex-lite-1.5', 'moonex-fast-1.5', 'moonex-pro-1.5',
  'moonex-pro-max-1.5', 'moonex-ultra-1.5', 'moonex-reasoning-1.5',
  'moonex-code-1.5', 'moonex-vision-1.5', 'moonex-research-1.5',
] as const;

const allCapabilities = { vision: true, reasoning: true, search: true, tools: true };

function makeResponse() {
  const chunks: string[] = [];
  const response: any = {
    writableEnded: false, headers: {}, statusCode: 200,
    status(code: number) { response.statusCode = code; return response; },
    setHeader(name: string, value: string) { response.headers[name] = value; },
    flushHeaders() {}, write(chunk: string) { chunks.push(chunk); return true; },
    end() { response.writableEnded = true; },
    json(payload: unknown) { response.jsonPayload = payload; response.end(); }, chunks,
  };
  return response;
}

function makeRequest(model: string) {
  return {
    method: 'POST', headers: {}, socket: { remoteAddress: `matrix-${model}` },
    body: { model, messages: [{ role: 'user', content: 'Run the Moonex profile regression check.' }], thinkingLevel: 'none', enableWebSearch: model === 'moonex-research-1.5' },
  };
}

test('all nine Moonex profiles reach a compatible provider and complete streaming', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.MYAI_API_URL;
  const originalKey = process.env.MYAI_API_KEY;
  const calls: string[] = [];
  process.env.MYAI_API_URL = 'https://moonex-matrix.test/v1';
  process.env.MYAI_API_KEY = 'matrix-key';

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input); calls.push(url);
      if (url.endsWith('/models')) return new Response(JSON.stringify([{ id: 'matrix-provider', capabilities: allCapabilities }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response('data: {"choices":[{"delta":{"content":"matrix ok"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }) as typeof fetch;

    for (const model of profiles) {
      const response = makeResponse();
      await handler(makeRequest(model), response);
      const stream = response.chunks.join('');
      assert.equal(response.statusCode, 200, `${model} should start an SSE response`);
      assert.match(stream, new RegExp(`\\"moonexModel\\":\\"${model}\\"`), `${model} route event missing`);
      assert.match(stream, /"type":"chunk"/, `${model} chunk missing`);
      assert.match(stream, /"type":"done"/, `${model} completion missing`);
      assert.doesNotMatch(stream, /"type":"error"/, `${model} unexpectedly emitted an error`);
    }
    assert.equal(calls.filter((url) => url.endsWith('/models')).length, profiles.length);
    assert.equal(calls.filter((url) => url.endsWith('/chat/completions')).length, profiles.length);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.MYAI_API_URL; else process.env.MYAI_API_URL = originalUrl;
    if (originalKey === undefined) delete process.env.MYAI_API_KEY; else process.env.MYAI_API_KEY = originalKey;
  }
});
