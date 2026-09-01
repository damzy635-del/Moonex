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

function request(model: string, prompt: string) {
  return {
    method: 'POST',
    headers: {},
    socket: { remoteAddress: `api-test-${Math.random()}` },
    body: { model, messages: [{ role: 'user', content: prompt }], thinkingLevel: 'none', enableWebSearch: false },
  };
}

const allCapabilities = { vision: true, reasoning: true, search: true, tools: true };

async function runChat(model: string, prompt: string) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/models')) return responseFor(JSON.stringify([{ id: 'provider-fast', capabilities: allCapabilities }]));
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;
  const response = makeResponse();
  await handler(request(model, prompt), response);
  return { upstreamBody: JSON.parse(String(calls[1].init?.body)), stream: response.chunks.join(''), calls };
}

test('manual Moonex selection reaches the API with the selected Moonex profile', async () => {
  process.env.MYAI_API_URL = 'https://moonex-upstream.test/v1';
  process.env.MYAI_API_KEY = 'test-key';
  const { upstreamBody, stream } = await runChat('moonex-ultra-1.5', 'Explain this carefully');
  assert.equal(upstreamBody.model, 'provider-fast');
  assert.equal(upstreamBody.max_tokens, 4096);
  assert.match(upstreamBody.messages[0].content, /Moonex Ultra 1\.5/);
  assert.match(stream, /"type":"route"/);
  assert.match(stream, /"moonexModel":"moonex-ultra-1\.5"/);
  assert.match(stream, /"modelUsed":"moonex-ultra-1\.5"/);
  assert.doesNotMatch(stream, /provider-fast/);
});

test('Auto selection resolves to a Moonex profile before the upstream request', async () => {
  const { upstreamBody, stream } = await runChat('auto', 'Write a React authentication system');
  assert.equal(upstreamBody.model, 'provider-fast');
  assert.equal(upstreamBody.max_tokens, 4096);
  assert.match(upstreamBody.messages[0].content, /Moonex Code 1\.5/);
  assert.match(stream, /"moonexModel":"moonex-code-1\.5"/);
  assert.match(stream, /"modelUsed":"moonex-code-1\.5"/);
  assert.doesNotMatch(stream, /provider-fast/);
});

test('streaming provider error objects are normalized into a readable Moonex error', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/models')) return responseFor(JSON.stringify([{ id: 'provider-code', capabilities: allCapabilities }]));
    return new Response('data: {"error":{"detail":"Spikes in demand are usually temporary. Please retry shortly."}}\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;
  const response = makeResponse();
  await handler(request('moonex-code-1.5', 'Fix this code'), response);
  const stream = response.chunks.join('');
  assert.doesNotMatch(stream, /\[object Object\]/);
  assert.match(stream, /"type":"error"/);
  assert.match(stream, /temporarily busy|temporarily unavailable|retry/i);
});

test('retryable upstream overload fails over to the next ranked provider', async () => {
  let chatAttempt = 0;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/models')) return responseFor(JSON.stringify([
      { id: 'unrelated-model', capabilities: allCapabilities },
      { id: 'codestral-latest', capabilities: allCapabilities },
      { id: 'backup-coder', capabilities: allCapabilities },
    ]));
    chatAttempt += 1;
    return new Response(chatAttempt === 1 ? JSON.stringify({ error: { message: 'Spikes in demand are usually temporary.' } }) : 'data: {"choices":[{"delta":{"content":"fallback ok"}}]}\n\ndata: [DONE]\n\n', { status: chatAttempt === 1 ? 503 : 200, headers: { 'Content-Type': chatAttempt === 1 ? 'application/json' : 'text/event-stream' } });
  }) as typeof fetch;
  const response = makeResponse();
  await handler(request('moonex-code-1.5', 'Debug this API'), response);
  const stream = response.chunks.join('');
  const firstBody = JSON.parse(String(calls[1].init?.body));
  const secondBody = JSON.parse(String(calls[2].init?.body));
  assert.equal(chatAttempt, 2);
  assert.equal(firstBody.model, 'codestral-latest');
  assert.equal(secondBody.model, 'backup-coder');
  assert.equal(firstBody.max_tokens, 4096);
  assert.equal(secondBody.max_tokens, 4096);
  assert.match(stream, /fallback ok/);
  assert.match(stream, /"type":"done"/);
  assert.doesNotMatch(stream, /\[object Object\]/);
});

test.after(() => { globalThis.fetch = originalFetch; });
