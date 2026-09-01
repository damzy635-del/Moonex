import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat';

const originalFetch = globalThis.fetch;

function responseFor(body: string, status = 200, contentType = 'application/json') {
  return new Response(body, {
    status,
    headers: { 'Content-Type': contentType },
  });
}

function makeResponse() {
  const chunks: string[] = [];
  const response: any = {
    writableEnded: false,
    statusCode: 200,
    headers: {},
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    setHeader(name: string, value: string) {
      response.headers[name] = value;
    },
    flushHeaders() {},
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      response.writableEnded = true;
    },
    json(payload: unknown) {
      response.jsonPayload = payload;
      response.end();
    },
    chunks,
  };
  return response;
}

function request(model: string, prompt: string) {
  return {
    method: 'POST',
    headers: {},
    socket: { remoteAddress: `api-test-${Math.random()}` },
    body: {
      model,
      messages: [{ role: 'user', content: prompt }],
      thinkingLevel: 'none',
      enableWebSearch: false,
    },
  };
}

async function runChat(model: string, prompt: string) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/models')) return responseFor(JSON.stringify([{ id: 'provider-fast' }]));
    return new Response(
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }) as typeof fetch;

  const response = makeResponse();
  await handler(request(model, prompt), response);
  const upstreamBody = JSON.parse(String(calls[1].init?.body));
  const stream = response.chunks.join('');
  return { upstreamBody, stream, calls };
}

test('manual Moonex selection reaches the API with the selected Moonex profile', async () => {
  process.env.MYAI_API_URL = 'https://moonex-upstream.test/v1';
  process.env.MYAI_API_KEY = 'test-key';
  const { upstreamBody, stream } = await runChat('moonex-ultra-1.5', 'Explain this carefully');

  assert.equal(upstreamBody.model, 'provider-fast');
  assert.match(upstreamBody.messages[0].content, /Moonex Ultra 1\.5/);
  assert.match(stream, /"type":"route"/);
  assert.match(stream, /"moonexModel":"moonex-ultra-1\.5"/);
  assert.match(stream, /"modelUsed":"moonex-ultra-1\.5"/);
  assert.doesNotMatch(stream, /provider-fast/);
});

test('Auto selection resolves to a Moonex profile before the upstream request', async () => {
  const { upstreamBody, stream } = await runChat('auto', 'Write a React authentication system');

  assert.equal(upstreamBody.model, 'provider-fast');
  assert.match(upstreamBody.messages[0].content, /Moonex Code 1\.5/);
  assert.match(stream, /"moonexModel":"moonex-code-1\.5"/);
  assert.match(stream, /"modelUsed":"moonex-code-1\.5"/);
  assert.doesNotMatch(stream, /provider-fast/);
});

test('streaming provider error objects are normalized instead of becoming [object Object]', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/models')) {
      return responseFor(JSON.stringify([{ id: 'provider-code' }]));
    }
    return new Response(
      'data: {"error":{"detail":"Spikes in demand are usually temporary. Please retry shortly."}}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }) as typeof fetch;

  const response = makeResponse();
  await handler(request('moonex-code-1.5', 'Fix this code'), response);
  const stream = response.chunks.join('');

  assert.doesNotMatch(stream, /\[object Object\]/);
  assert.match(stream, /Spikes in demand are usually temporary/);
});

test('retryable upstream overload fails over to the next ranked provider', async () => {
  const calls: string[] = [];
  let chatAttempt = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/models')) {
      return responseFor(JSON.stringify([
        { id: 'unrelated-model' },
        { id: 'qwen-coder' },
        { id: 'backup-coder' },
      ]));
    }

    const body = JSON.parse(String(arguments));
    void body;
    chatAttempt += 1;
    const init = arguments;
    void init;
    return new Response(
      chatAttempt === 1
        ? JSON.stringify({ error: { message: 'Spikes in demand are usually temporary.' } })
        : 'data: {"choices":[{"delta":{"content":"fallback ok"}}]}\n\ndata: [DONE]\n\n',
      {
        status: chatAttempt === 1 ? 503 : 200,
        headers: { 'Content-Type': chatAttempt === 1 ? 'application/json' : 'text/event-stream' },
      },
    );
  }) as typeof fetch;

  // The fetch stub above intentionally tracks attempts; inspect the emitted stream for success.
  const response = makeResponse();
  await handler(request('moonex-code-1.5', 'Debug this API'), response);
  const stream = response.chunks.join('');

  assert.equal(chatAttempt, 2);
  assert.match(stream, /fallback ok/);
  assert.match(stream, /"type":"done"/);
  assert.doesNotMatch(stream, /\[object Object\]/);
  void calls;
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
