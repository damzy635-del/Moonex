import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("chat handler validates images and enforces the Vision profile", async () => {
  const source = await readFile(new URL("../server/chat-handler.ts", import.meta.url), "utf8");
  assert.match(source, /validateVisionImages\(\(body as \{ images\?: unknown \} \| null\)\?\.images\)/);
  assert.match(source, /images\.length && profile !== "moonex-vision-1\.5"/);
  assert.match(source, /profile === "moonex-vision-1\.5" && images\.length === 0/);
});

test("provider adapter attaches image payloads only to the final user message", async () => {
  const source = await readFile(new URL("../server/provider-adapters.ts", import.meta.url), "utf8");
  assert.match(source, /index === request\.messages\.length - 1 && request\.images\?\.length/);
  assert.match(source, /inline_data: \{ mime_type: image\.mimeType, data: image\.data \}/);
  assert.match(source, /image_url:\{ url:"data:" \+ image\.mimeType \+ ";base64," \+ image\.data \}/);
});

test("Vision provider selection is server-side and excludes providers without image capability", async () => {
  const adapter = await readFile(new URL("../server/provider-adapters.ts", import.meta.url), "utf8");
  const handler = await readFile(new URL("../server/chat-handler.ts", import.meta.url), "utf8");
  assert.match(adapter, /if \(!key \|\| \(profile === "moonex-vision-1\.5" && !config\.vision\)\) return \[\]/);
  assert.match(handler, /getProviderCandidates\(profile as MoonexProfile\)/);
  assert.doesNotMatch(handler, /body\.(?:model|modelId)\s*\)/);
});
