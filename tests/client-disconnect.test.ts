import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/chat';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.MYAI_API_URL;
const originalKey = process.env.MYAI_API_KEY;

test('client disconnect aborts an active stream without starting fallback', async () => {
  process.env.MYAI_API_URL = 'https://moonex-disconnect.test/v1';
  process.env.MYAI_API_KEY = 'disconnect-test-key';

  const requestListeners = new Map<string, Array<(...args: any[]) => void>>();
  const responseListeners = new Map<string, Array<(...args: any[]) => void>>();
  const chunks: string[] = [];
  let chatAttempts = 0;

  const request: any = {
    method: 'POST',
    headers: {},
    socket: { remoteAddress: 'disconnect-regression-test' },
    body: {
      model: 'moonex-code-1.5',
      messages: [{ role: 'user', content: 'Test disconnect cancellation.' }],
      thinkingLevel: 'none',
      enableWebSearch: false,
    },
    on(event: string, listener: (...args: any[]) => void) {
      const listeners = requestListeners.get(event) || [];
      listeners.push(listener);
      requestListeners.set(event, listeners);
      return request;
    },
    off(event: string, listener: (...args: any[]) => void) {
      requestListeners.set(event, (requestListeners.get(event) || []).filter((item) => item !== listener));
      return request;
    },
  };

  const response: any = {
    writableEnded: false,
    statusCode: 200,
    headers: {},
    status(code: number) { response.statusCode = code; return response; },
    setHeader(name: string, value: string) { response.headers[name] = value; },
    flushHeaders() {},
    on(event: string, listener: (...args: any[]) => void) {
      const listeners = responseListeners.get(event) || [];
      listeners.push(listener);
      responseListeners.set(event, listeners);
      return response;
    },
    write(chunk: string) {
      chunks.push(chunk);
      if (chunk.includes('"type":"chunk"')) {
        for (const listener of responseListeners.get('close') || []) listener();
      }
      return true;
    },
    end() { response.writableEnded = true; },
    json(payload: unknown) { response.jsonPayload = payload; response.end(); },
  };

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify([
          { id: 'codestral-latest', capabilities: { vision: true, reasoning: true, search: true, tools: true } },
          { id: 'backup-coder', capabilities: { vision: true, reasoning: true, search: true, tools: true } },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      chatAttempts += 1;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            'data: {"choices":[{"delta":{"content":"partial response"}}]}\\n\\n',
          ));
        },
      });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }) as typeof fetch;

    await handler(request, response);

    assert.equal(chatAttempts, 1, 'disconnect must not start another provider attempt');
    assert.match(chunks.join(''), /partial response/);
    assert.doesNotMatch(chunks.join(''), /fallback response/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.MYAI_API_URL;
    else process.env.MYAI_API_URL = originalUrl;
    if (originalKey === undefined) delete process.env.MYAI_API_KEY;
    else process.env.MYAI_API_KEY = originalKey;
  }
});
