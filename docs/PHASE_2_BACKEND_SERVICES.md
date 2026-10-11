# Moonex Phase 2 — Backend Services

Phase 2 establishes the backend as the trust boundary for provider integrations.

## Service boundaries

- `/api/chat` — My AI chat and SSE streaming.
- `/api/models` — live model catalog from the My AI service.
- `/api/research` — long-running research workflow; provider credentials remain server-side.
- `/api/tts` — audio synthesis; the Gemini credential is server-side only.
- `/api/code/run` — code execution endpoint; execution must remain isolated from the Vercel function runtime before exposing it to untrusted users at scale.

## Secrets

Provider credentials must only exist in Vercel Environment Variables. Never expose them through `VITE_*`, client bundles, `localStorage`, or public files.

## Vercel hardening

API responses are marked `no-store`, and common browser security headers are applied globally. API routes have explicit function mappings so they do not depend on the SPA fallback.

## Important deployment note

This branch does not deploy automatically from these changes. Deploy it manually after review/testing. The production `main` branch remains unchanged.
