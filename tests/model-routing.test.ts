import test from "node:test";
import assert from "node:assert/strict";
import { resolveGeminiModel } from "../server/model-routing.ts";

const profiles = [
  ["moonex-lite-1.5", "GEMINI_MODEL_LITE"],
  ["moonex-fast-1.5", "GEMINI_MODEL_FAST"],
  ["moonex-pro-1.5", "GEMINI_MODEL_PRO"],
  ["moonex-pro-max-1.5", "GEMINI_MODEL_PRO_MAX"],
  ["moonex-ultra-1.5", "GEMINI_MODEL_ULTRA"],
  ["moonex-reasoning-1.5", "GEMINI_MODEL_REASONING"],
  ["moonex-code-1.5", "GEMINI_MODEL_CODE"],
] as const;

test("each text profile selects its own configured Gemini model", () => {
  for (const [profile, variable] of profiles) {
    assert.equal(resolveGeminiModel(profile, { [variable]: `custom-${profile}`, GEMINI_MODEL: "shared-default" }), `custom-${profile}`);
  }
});

test("profile-specific model falls back to the shared configured model", () => {
  assert.equal(resolveGeminiModel("moonex-code-1.5", { GEMINI_MODEL: "shared-default" }), "shared-default");
});

test("model routing trims environment values and uses a safe default", () => {
  assert.equal(resolveGeminiModel("moonex-pro-1.5", { GEMINI_MODEL_PRO: "  gemini-pro  ", GEMINI_MODEL: "shared" }), "gemini-pro");
  assert.equal(resolveGeminiModel("moonex-lite-1.5", {}), "gemini-3.1-flash-lite");
});

test("unsupported profile IDs cannot select arbitrary upstream models", () => {
  assert.equal(resolveGeminiModel("attacker-controlled-model", { GEMINI_MODEL_CODE: "configured-code-model", GEMINI_MODEL: "shared-default" }), "shared-default");
});
