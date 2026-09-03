import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/health';

function responseFor(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

function makeResponse() {
  const response: any = { statusCode: 200, headers: {}, writableEnded: false };
  response.status = (code: number) => { response.statusCode = code; return response; };
  response.setHeader = (name: string, value: string) => { response.headers[name] = value; };
  response.json = (payload: unknown) => { response.jsonPayload = payload; response.writableEnded = true; };
  return response;
}

const originalFetch = globalThis.fetch;

test('health reports all nine Moonex profiles covered by a four-provider catalog', async () => {
  process.env.MYAI_API_URL = 'https://moonex-upstream.test/v1';
  process.env.MYAI_API_KEY = 'test-key';
  globalThis.fetch = (async () => responseFor(JSON.stringify({ models: {
    'gpt-5.6-sol': { id: 'gpt-5.6-sol', provider: 'openai', capabilities: { vision: true, reasoning: true, search: false, tools: true } },
    'gemini-3.7-flash': { id: 'gemini-3.7-flash', provider: 'google', capabilities: { vision: true, reasoning: true, search: true, tools: true } },
    'mistral-large-latest': { id: 'mistral-large-latest', provider: 'mistral', capabilities: { vision: true, reasoning: true, search: false, tools: true } },
    'codestral-latest': { id: 'codestral-latest', provider: 'mistral', capabilities: { vision: false, reasoning: false, search: false, tools: true } },
    'openai/gpt-oss-120b': { id: 'openai/gpt-oss-120b', provider: 'groq', capabilities: { vision: false, reasoning: true, search: false, tools: true } },
    'gemini-2.5-flash': { id: 'gemini-2.5-flash', provider: 'google', capabilities: { vision: true, reasoning: false, search: true, tools: false } },
    'gemini-2.5-pro': { id: 'gemini-2.5-pro', provider: 'google', capabilities: { vision: true, reasoning: true, search: true, tools: false } },
  }}));
  const response = makeResponse();
  await handler({ method: 'GET' }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonPayload.status, 'ok');
  assert.equal(response.jsonPayload.expectedProviderCount, 4);
  assert.equal(response.jsonPayload.expectedProfileCount, 9);
  assert.equal(response.jsonPayload.profileCoverage.length, 9);
  assert.ok(response.jsonPayload.profileCoverage.every((item: any) => item.eligibleModels > 0));
});

test.after(() => { globalThis.fetch = originalFetch; });
