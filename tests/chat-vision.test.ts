import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("chat handler requires images only for the Vision profile", async () => {
  const source = await readFile(new URL("../server/chat-handler.ts", import.meta.url), "utf8");
  assert.match(source, /"moonex-vision-1\.5"/);
  assert.match(source, /validateVisionImages\(\(body as \{ images\?: unknown \} \| null\)\?\.images\)/);
  assert.match(source, /images\.length && profile !== "moonex-vision-1\.5"/);
  assert.match(source, /profile === "moonex-vision-1\.5" && images\.length === 0/);
});

test("chat handler attaches validated image parts only to the final Vision user message", async () => {
  const source = await readFile(new URL("../server/chat-handler.ts", import.meta.url), "utf8");
  assert.match(source, /profile === "moonex-vision-1\.5" && index === messages\.length - 1[\s\S]*?buildVisionParts\(message\.content, images\)/);
  assert.match(source, /import \{ buildVisionParts, validateVisionImages \} from "\.\/vision-input\.js"/);
});

test("Vision model routing remains server-side and uses the profile-specific override", async () => {
  const routing = await readFile(new URL("../server/model-routing.ts", import.meta.url), "utf8");
  assert.match(routing, /"moonex-vision-1\.5"\s*:\s*"GEMINI_MODEL_VISION"/);
  const handler = await readFile(new URL("../server/chat-handler.ts", import.meta.url), "utf8");
  assert.match(handler, /resolveGeminiModel\(profile\)/);
  assert.doesNotMatch(handler, /body\.(?:model|modelId)\s*\)/);
});
