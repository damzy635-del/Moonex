import test from "node:test";
import assert from "node:assert/strict";
import { getProviderCandidates, readProviderStream, type MoonexProfile } from "../server/provider-adapters.ts";

const profile: MoonexProfile = "moonex-pro-1.5";

test("provider discovery includes only providers with credentials", () => {
  const candidates = getProviderCandidates(profile, {
    GEMINI_API_KEY: "google-secret",
    GROQ_API_KEY: "groq-secret",
  });
  assert.deepEqual(candidates.map((candidate) => candidate.id), ["google", "groq"]);
});

test("provider priority is configurable and does not add unconfigured providers", () => {
  const candidates = getProviderCandidates(profile, {
    GEMINI_API_KEY: "google-secret",
    GROQ_API_KEY: "groq-secret",
    MOONEX_PROVIDER_PRIORITY: "groq,google,groq,unknown",
  });
  assert.deepEqual(candidates.map((candidate) => candidate.id), ["groq", "google"]);
});

test("vision routing excludes providers without image capability", () => {
  const candidates = getProviderCandidates("moonex-vision-1.5", {
    OPENAI_API_KEY: "openai-secret",
    MISTRAL_API_KEY: "mistral-secret",
    GROQ_API_KEY: "groq-secret",
  });
  assert.deepEqual(candidates.map((candidate) => candidate.id), ["openai"]);
});

test("provider model overrides are applied without exposing credentials elsewhere", () => {
  const candidates = getProviderCandidates(profile, {
    OPENAI_API_KEY: "openai-secret",
    MOONEX_OPENAI_MODEL_MOONEX_PRO_1_5: "custom-model",
    MOONEX_PROVIDER_PRIORITY: "openai",
  });
  assert.equal(candidates[0]?.model, "custom-model");
  assert.equal(candidates[0]?.key, "openai-secret");
});

test("Gemini SSE frames are normalized into text deltas", async () => {
  const payload = [
    'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}',
    'data: {"candidates":[{"content":{"parts":[{"text":" Moonex"}]}}]}',
    "",
  ].join("\n");
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  }));
  const output: string[] = [];
  await readProviderStream(response, "google", (text) => output.push(text));
  assert.deepEqual(output, ["Hello", " Moonex"]);
});

test("OpenAI-compatible SSE frames are normalized into text deltas", async () => {
  const payload = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}',
    'data: {"choices":[{"delta":{"content":" Moonex"}}]}',
    "data: [DONE]",
    "",
  ].join("\n");
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  }));
  const output: string[] = [];
  await readProviderStream(response, "groq", (text) => output.push(text));
  assert.deepEqual(output, ["Hello", " Moonex"]);
});
