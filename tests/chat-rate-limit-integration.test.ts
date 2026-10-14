import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("chat verifies identity before consuming the shared per-user limiter", async () => {
  const source = await readFile(new URL("../server/chat-handler.ts", import.meta.url), "utf8");
  const authIndex = source.indexOf("authClient.auth.getUser(token)");
  const limiterIndex = source.indexOf("const rateLimiter = createChatRateLimiter()");
  const consumeIndex = source.indexOf("rateLimiter.consume(authData.user.id)");
  assert.ok(authIndex >= 0 && limiterIndex > authIndex && consumeIndex > limiterIndex);
});

test("production chat fails closed if shared rate limiting is missing or unavailable", async () => {
  const source = await readFile(new URL("../server/chat-handler.ts", import.meta.url), "utf8");
  assert.match(source, /!rateLimiter && process\.env\.NODE_ENV === "production"/);
  assert.match(source, /RATE_LIMITER_NOT_CONFIGURED/);
  assert.match(source, /RATE_LIMITER_UNAVAILABLE/);
  assert.match(source, /sendError\(response, 503, "RATE_LIMITER_UNAVAILABLE"/);
});

test("chat publishes rate-limit headers and rejects excess requests before provider calls", async () => {
  const source = await readFile(new URL("../server/chat-handler.ts", import.meta.url), "utf8");
  const consumeIndex = source.indexOf("rateLimiter.consume(authData.user.id)");
  const limitedIndex = source.indexOf('sendError(response, 429, "CHAT_RATE_LIMITED"');
  const providerIndex = source.indexOf("const apiKey = process.env.GEMINI_API_KEY");
  assert.ok(consumeIndex >= 0 && limitedIndex > consumeIndex && providerIndex > limitedIndex);
  assert.match(source, /setHeader\("X-RateLimit-Limit", "10"\)/);
  assert.match(source, /setHeader\("X-RateLimit-Remaining", String\(decision\.remaining\)\)/);
  assert.match(source, /setHeader\("Retry-After", String\(decision\.retryAfterSeconds\)\)/);
});
