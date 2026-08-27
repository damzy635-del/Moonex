# My AI Integration

This app's `/api/chat` (and, following the same pattern, `/api/research`
and `/api/code/run`) route through **My AI's unified API** instead of
calling Google Gemini directly. This is what "runs on the API key" means
for this app: a My AI-issued API key, held server-side, talking to My AI's
`/v1/chat/completions` endpoint — which itself can route to Gemini, OpenAI,
Groq, or Mistral, with automatic fallback if one is down.

## Required environment variables

```
MYAI_API_URL=https://your-my-ai-deployment.example.com/v1
MYAI_API_KEY=mai_live_...   # issued from My AI's admin panel, Keys section, needs the "chat" scope
```

`GEMINI_API_KEY` is still used, but only by `/api/tts` — My AI has no
audio-synthesis capability, so text-to-speech stays on direct Gemini.

## Required setup on the My AI deployment

This app's model picker offers several distinct Gemini model IDs
(`gemini-3.7-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`,
`gemini-3.1-flash-lite`). My AI's provider registry only recognizes a
model ID if it's the provider's own configured default (`GOOGLE_MODEL` env
var) or explicitly registered via `AI_MODEL_ROUTES`. **Without this, every
model selection except the deployment's single default will fail with "no
provider is configured to serve this model" was 400 error.**

Set this on the My AI deployment:

```
AI_MODEL_ROUTES=gemini-3.7-flash:google,gemini-2.5-flash:google,gemini-2.5-pro:google,gemini-3.1-flash-lite:google
```

(`gemini-3.7-flash-thinking` isn't a real model ID — it's this app's own
shorthand for "gemini-3.7-flash with thinking forced on," resolved in
`server.ts` before the request ever reaches My AI, so it doesn't need a
route entry.)

## What changed in `server.ts`

- `toMyAIMessage()` — translates this app's `{role, content, files}`
  message shape into My AI's canonical format: a plain string for
  text-only messages, or a list of `{type:"text"}` / `{type:"image_url"}`
  parts when files are attached (the same shape OpenAI's API uses, which
  My AI standardized on).
- `resolveMyAIModelAndThinking()` — the same model/thinking-level split
  logic this app already used against Gemini directly, now producing the
  `model` and `thinking_level` fields My AI's API expects.
- `/api/chat` now does a single fetch to `${MYAI_API_URL}/chat/completions`
  with `stream: true`, and translates My AI's OpenAI-compatible SSE chunks
  (`choices[0].delta.content`, plus routing metadata in `x_unified_api`)
  back into this app's own SSE event shape (`{type:"chunk"}` /
  `{type:"done"}` / `{type:"error"}`) — so **the React frontend needed zero
  changes**.
- The manual per-model retry/fallback loop (`getFallbackModels`,
  `isTransientError`, the nested retry loop) is no longer used by
  `/api/chat` — My AI already does this server-side (Phases 5-6: intra-
  provider retries, cross-provider fallback, circuit breaker), and can
  fall back across entirely different providers (OpenAI, Groq, Mistral),
  not just other Gemini model variants. Those helper functions are left
  in place since `/api/research` and `/api/code/run` haven't been migrated
  yet (see below).

## Capabilities added to My AI to support this integration

Before this integration, My AI's unified API was text-only, single-turn,
with no search or extended-reasoning support. To avoid losing features
this app already had working against Gemini directly, My AI's API gained:

- **Vision**: multimodal message content (text + `image_url` parts,
  base64 data URIs only — a plain image URL is rejected with a clear
  error rather than fetched server-side or silently dropped).
- **Search grounding**: `enable_search: true` on the request; only
  honored by providers that support it (currently just Google) — a
  request with search enabled is automatically routed only to
  search-capable providers, never silently served without search.
- **Thinking level**: `thinking_level: "low"|"high"` — a soft preference,
  honored only on models known to support it (currently Gemini 3.7-class),
  silently ignored elsewhere rather than erroring, since forcing a
  provider swap just because it can't do extended reasoning would be a
  worse tradeoff than just answering normally.

All three are covered by unit and integration tests in the My AI repo
(`tests/test_google_provider.py`, `tests/test_multimodal_capabilities.py`).

## Not yet migrated

- `/api/research` and `/api/code/run` still call Gemini directly via
  `generateContentWithRetryAndFallback`. They're both single-shot
  (non-streaming) generate calls under the hood, so migrating them follows
  the same pattern as `/api/chat` — lower priority since they're less
  central to the core experience, but worth doing for consistency (right
  now they don't benefit from My AI's fallback/rate-limiting/billing
  either).
- `/api/tts` is explicitly out of scope — audio synthesis isn't a
  capability My AI has, and building it wasn't part of this integration.
