import test from "node:test";
import assert from "node:assert/strict";
import { RateLimitUnavailableError, UpstashRateLimiter, createChatRateLimiter } from "../server/rate-limit.ts";

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("shared limiter allows up to ten requests and rejects the next request", async () => {
  let count = 0;
  const limiter = new UpstashRateLimiter("https://redis.example", "test-token", 2, 60, async () => {
    count += 1;
    return response(200, [{ result: count }]);
  });
  assert.deepEqual(await limiter.consume("user-1", 120), { allowed: true, remaining: 1, retryAfterSeconds: 0 });
  assert.deepEqual(await limiter.consume("user-1", 120), { allowed: true, remaining: 0, retryAfterSeconds: 0 });
  assert.deepEqual(await limiter.consume("user-1", 120), { allowed: false, remaining: 0, retryAfterSeconds: 60 });
});

test("shared limiter uses atomic Redis EVAL with a per-user fixed-window key", async () => {
  let requestUrl = "";
  let requestBody = "";
  const limiter = new UpstashRateLimiter("https://redis.example/", "test-token", 10, 60, async (input, init) => {
    requestUrl = String(input);
    requestBody = String(init?.body);
    return response(200, [{ result: 1 }]);
  });
  await limiter.consume("user-abc", 125);
  assert.equal(requestUrl, "https://redis.example/pipeline");
  const command = JSON.parse(requestBody) as string[][];
  assert.equal(command[0][0], "EVAL");
  assert.equal(command[0][2], "1");
  assert.equal(command[0][3], "moonex:chat:rate:user-abc:2");
});

test("limiter fails closed when Redis is unavailable", async () => {
  const limiter = new UpstashRateLimiter("https://redis.example", "test-token", 10, 60, async () => response(503, {}));
  await assert.rejects(limiter.consume("user-1"), RateLimitUnavailableError);
});

test("limiter rejects malformed Redis responses", async () => {
  const limiter = new UpstashRateLimiter("https://redis.example", "test-token", 10, 60, async () => response(200, [{ result: "not-a-number" }]));
  await assert.rejects(limiter.consume("user-1"), RateLimitUnavailableError);
});

test("rate limiter requires both shared-store settings", () => {
  assert.equal(createChatRateLimiter({ UPSTASH_REDIS_REST_URL: "https://redis.example" } as NodeJS.ProcessEnv), null);
  assert.equal(createChatRateLimiter({ UPSTASH_REDIS_REST_TOKEN: "token" } as NodeJS.ProcessEnv), null);
  assert.ok(createChatRateLimiter({
    UPSTASH_REDIS_REST_URL: "https://redis.example",
    UPSTASH_REDIS_REST_TOKEN: "token",
  } as NodeJS.ProcessEnv));
});
