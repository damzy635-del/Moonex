import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel exposes health and model catalog routes alongside chat", async () => {
  const [health, models, chat] = await Promise.all([
    readFile(new URL("../api/v1/health.ts", import.meta.url), "utf8"),
    readFile(new URL("../api/v1/models.ts", import.meta.url), "utf8"),
    readFile(new URL("../api/v1/chat.ts", import.meta.url), "utf8"),
  ]);
  assert.match(health, /status: "ok", service: "moonex-api"/);
  assert.match(health, /request\.method !== "GET" && request\.method !== "HEAD"/);
  assert.match(models, /MODEL_PROFILES/);
  assert.match(models, /models: MODEL_PROFILES/);
  assert.match(models, /request\.method !== "GET" && request\.method !== "HEAD"/);
  assert.match(chat, /chat-handler/);
});
