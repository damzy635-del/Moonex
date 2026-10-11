import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.js';
import { clearConcurrency, concurrencyState } from '../lib/concurrency.js';

const originalFetch = globalThis.fetch;
const originalBase = process.env.MYAI_API_URL;
const originalKey = process.env.MYAI_API_KEY;
const originalLimit = process.env.MOONEX_MAX_CONCURRENT;

function makeResponse() {
  const chunks: string[] = [];
  const response: any = {
    writableEnded: false,
    statusCode: 200,
    headers: {},
    chunks,
    status(code: number) { response.statusCode = code; return response; },
    setHeader(name: string, value: string) { response.headers[name] = value; },
    flushHeaders() {},
    write(chunk: string) { chunks.push(chunk); return true; },
    end() { response.writableEnded = true; },
    json(payload: unknown) { response.jsonPayload = payload; response.end(); },
  };
  return response;
}

function request(ip: string, model = 'moonex-code-1.5') {
  return {
    method: 'POST',
    headers: {},
    socket: { remoteAddress: ip },
    body: {
      model,
      messages: [{ role: 'user', content: 'load regression' }],
      thinkingLevel: 'none',
      enableWebSearch: false,
    },
  };
}

test('P4 load regression does not leak concurrency on early validation exits', async () => {
  clearConcurrency();
  delete process.env.MYAI_API_URL;
  delete process.env.MYAI_API_KEY;

  for (let index = 0; index < 20; index += 1) {
    const response = makeResponse();
    await handler(request(`early-exit-${index}`), response);
    assert.equal(response.statusCode, 500);
  }

  assert.equal(concurrencyState().active, 0);

  process.env.MYAI_API_URL = 'https://moonex-load.test/v1';
  process.env.MYAI_API_KEY = 'test-key';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/models')) {
      return new Response(JSON.stringify([{ id: 'provider-fast', capabilities: { vision: true, reasoning: true, search: true, tools: true } }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as typeof fetch;

  const response = makeResponse();
  await handler(request('post-leak-check'), response);
  assert.equal(response.statusCode, 200);
  assert.match(response.chunks.join(''), /"type":"done"/);
  assert.equal(concurrencyState().active, 0);
});

test('P4 burst regression never exceeds the configured concurrent admission limit', async () => {
  clearConcurrency();
  process.env.MOONEX_MAX_CONCURRENT = '4';
  process.env.MYAI_API_URL = 'https://moonex-load.test/v1';
  process.env.MYAI_API_KEY = 'test-key';

  let activeUpstream = 0;
  let maxActiveUpstream = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/models')) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(JSON.stringify([{ id: 'provider-fast', capabilities: { vision: true, reasoning: true, search: true, tools: true } }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    activeUpstream += 1;
    maxActiveUpstream = Math.max(maxActiveUpstream, activeUpstream);
    await new Promise((resolve) => setTimeout(resolve, 15));
    activeUpstream -= 1;

    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as typeof fetch;

  const total = 24;
  const responses = await Promise.all(
    Array.from({ length: total }, (_, index) => {
      const response = makeResponse();
      return handler(request(`burst-${index}`), response).then(() => response);
    }),
  );

  const { limit } = concurrencyState();
  assert.equal(limit, 4);
  assert.ok(maxActiveUpstream <= limit);
  assert.equal(responses.filter((response) => response.statusCode === 200).length, limit);
  assert.equal(responses.filter((response) => response.statusCode === 503).length, total - limit);
  assert.ok(responses.every((response) => response.writableEnded));
  assert.equal(concurrencyState().active, 0);
});

test.after(() => {
  globalThis.fetch = originalFetch;
  clearConcurrency();

  if (originalBase === undefined) delete process.env.MYAI_API_URL;
  else process.env.MYAI_API_URL = originalBase;

  if (originalKey === undefined) delete process.env.MYAI_API_KEY;
  else process.env.MYAI_API_KEY = originalKey;

  if (originalLimit === undefined) delete process.env.MOONEX_MAX_CONCURRENT;
  else process.env.MOONEX_MAX_CONCURRENT = originalLimit;
});
