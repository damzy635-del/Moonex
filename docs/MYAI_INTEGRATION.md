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

The model picker is Moonex-native. It exposes the manual profiles `Moonex Lite 1.5`, `Moonex Fast 1.5`, `Moonex Pro 1.5`, `Moonex Pro Max 1.5`, `Moonex Ultra 1.5`, `Moonex Reasoning 1.5`, `Moonex Code 1.5`, `Moonex Vision 1.5`, and `Moonex Research 1.5`, plus `Auto`.

The browser stores and sends only Moonex profile IDs. The backend resolves a manual profile, or classifies an `Auto` request into a Moonex profile, before translating it to the provider model required by the unified API. Provider IDs are never returned in SSE metadata or rendered by the client.

The configured My AI deployment must expose at least one usable upstream model through `/models`. Provider selection remains a server-side implementation detail; no provider-specific route table is required in the browser.

## What changed in the chat and model-state path

- The client treats the selected Moonex profile ID as the single source of truth for the header, composer, conversation state, streaming bubble, assistant metadata, local storage, and cloud sync.
- `/api/models` returns the Moonex catalog and `Auto`; it does not expose the provider catalog to the browser.
- `/api/chat` emits a `route` SSE event with the resolved Moonex profile before content chunks. For example, an `Auto` request can transition from `Auto` to `Moonex Code 1.5` while streaming, without showing the provider model.
- The local Express development server delegates `/api/models` and `/api/chat` to the same handlers used by the deployment API, preventing dev/prod model-state drift.
- Provider model resolution and the upstream `/chat/completions` request remain server-side. The client receives only Moonex profile IDs and display names.

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
