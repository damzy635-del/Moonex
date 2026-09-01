import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat';

const originalFetch = globalThis.fetch;

function responseFor(body: string, status = 200, contentType = 'application/json') {
  return new Response(body, { status, headers: { 'Content-Type': contentType } });
}

function makeResponse() {
  const chunks: string[] = [];
  const response: any = {
    writableEnded: false,
    statusCode: 200,
    headers: {},
    status(code: number) { response.statusCode = code; return response; },
    setHeader(name: string, value: string) { response.headers[name] = value; },
    flushHeaders() {},
    write(chunk: string) { chunks.push(chunk); return true; },
    end() { response.writableEnded = true; },
    json(payload: unknown) { response.jsonPayload = payload; response.end(); },
    chunks,
  };
  return response;
}

function request() {
  return {
    method: 'POST',
    headers: {},
    socket: { remoteAddress: `diagnostic-test-${Math.random()}` },
    body: {
      model: 'moonex-pro-1.5',
      messages: [{ role: 'user', content: 'Explain this architecture.' }],
      thinkingLevel: 'none',
      enableWebSearch: false,
    },
  };
}

test('fallback error reports provider, status and machine-readable reason', async () => {
  process.env.MYAI_API_URL = 'https://moonex-upstream.test/v1';
  process.env.MYAI_API_KEY = 'test-key';

  let chatAttempt = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/models')) {
      return responseFor(JSON.stringify([
        { id: 'gpt-pro', provider: 'OpenAI' },
        { id: 'gemini-pro', provider: 'Google' },
        { id: 'mistral-pro', provider: 'Mistral' },
      ]));
    }

    chatAttempt += 1;
    const errors = [
      { status: 429, body: { error: { message: 'Rate limit exceeded.' } } },
      { status: 503, body: { error: { message: 'Provider temporarily unavailable.' } } },
      { status: 500, body: { error: { message: 'Upstream failure.' } } },
    ];
    const failure = errors[chatAttempt - 1] || errors[2];
    return responseFor(JSON.stringify(failure.body), failure.status);
  }) as typeof fetch;

  const response = makeResponse();
  await handler(request(), response);
  const stream = response.chunks.join('');
  const errorEvent = stream.split('data: ').map((part) => {
    try { return JSON.parse(part); } catch { return null; }
  }).find((event) => event?.type === 'error');

  assert.ok(errorEvent);
  assert.equal(errorEvent.code, 'PROVIDER_EXHAUSTED');
  assert.equal(errorEvent.status, 500);
  assert.equal(errorEvent.attempts.length, 3);
  assert.equal(errorEvent.attempts[0].provider, 'OpenAI');
  assert.equal(errorEvent.attempts[0].status, 429);
  assert.equal(errorEvent.attempts[0].reason, 'RATE_LIMITED');
  assert.equal(errorEvent.attempts[1].provider, 'Google');
  assert.equal(errorEvent.attempts[1].status, 503);
  assert.equal(errorEvent.attempts[1].reason, 'UPSTREAM_UNAVAILABLE');
  assert.equal(errorEvent.attempts[2].provider, 'Mistral');
  assert.equal(errorEvent.attempts[2].status, 500);
  assert.equal(errorEvent.attempts[2].reason, 'UPSTREAM_UNAVAILABLE');
  assert.match(errorEvent.error, /OpenAI.*RATE_LIMITED.*429/i);
  assert.match(errorEvent.error, /Google.*UPSTREAM_UNAVAILABLE.*503/i);
  assert.doesNotMatch(errorEvent.error, /\[object Object\]/);
});

test('invalid requests do not get mislabeled as temporary provider capacity failures', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/models')) return responseFor(JSON.stringify([{ id: 'gpt-pro', provider: 'OpenAI' }]));
    return responseFor(JSON.stringify({ error: { message: 'Invalid request: messages are malformed.' } }), 422);
  }) as typeof fetch;

  const response = makeResponse();
  await handler(request(), response);
  const stream = response.chunks.join('');
  assert.match(stream, /"code":"INVALID_REQUEST"/);
  assert.doesNotMatch(stream, /temporarily busy/i);
});

test.after(() => { globalThis.fetch = originalFetch; });
