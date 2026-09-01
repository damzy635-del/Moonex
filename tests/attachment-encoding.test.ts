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

test('UTF-8 code attachment is decoded and forwarded as text', async () => {
  process.env.MYAI_API_URL = 'https://moonex-upstream.test/v1';
  process.env.MYAI_API_KEY = 'test-key';

  const source = '┌──────────────┐\n│ UTF-8 TEST 😀 │\n└──────────────┘\nconst café = "مرحبا 你好";';
  const dataUrl = `data:text/plain;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/models')) return responseFor(JSON.stringify([{ id: 'provider-code' }]));
    return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });
  }) as typeof fetch;

  const response = makeResponse();
  await handler({
    method: 'POST',
    headers: {},
    socket: { remoteAddress: `attachment-test-${Math.random()}` },
    body: {
      model: 'moonex-code-1.5',
      messages: [{
        role: 'user',
        content: 'Analyze this file',
        files: [{ name: 'example.ts', type: 'code', mimeType: 'text/plain', data: dataUrl }],
      }],
      thinkingLevel: 'none',
      enableWebSearch: false,
    },
  }, response);

  const upstreamBody = JSON.parse(String(calls[1].init?.body));
  const attachmentMessage = upstreamBody.messages[1];
  const serialized = JSON.stringify(attachmentMessage);

  assert.match(serialized, /┌──────────────┐/);
  assert.match(serialized, /UTF-8 TEST 😀/);
  assert.match(serialized, /café/);
  assert.match(serialized, /مرحبا/);
  assert.match(serialized, /你好/);
  assert.doesNotMatch(serialized, /â|â/);
});

test.after(() => { globalThis.fetch = originalFetch; });
