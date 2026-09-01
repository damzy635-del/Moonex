import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat';

const originalFetch = globalThis.fetch;

function responseFor(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
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
  await handler(
    {
      method: 'POST',
      headers: {},
      socket: { remoteAddress: 'api-test' },
      body: {
        model,
        messages: [{ role: 'user', content: prompt }],
        thinkingLevel: 'none',
        enableWebSearch: false,
      },
    },
    response,
  );

  const upstreamBody = JSON.parse(String(calls[1].init?.body));
  const stream = response.chunks.join('');
  return { upstreamBody, stream };
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

test.after(() => {
  globalThis.fetch = originalFetch;
});
