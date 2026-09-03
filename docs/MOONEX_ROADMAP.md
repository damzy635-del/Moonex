# Moonex 1.0 Engineering Roadmap

## Mission
Build a production-grade AI product that competes on reliability, responsiveness, routing quality, multimodal support, research, and conversation UX.

## Guardrails
- Exactly 9 user-facing Moonex profiles.
- Exactly 4 providers: OpenAI, Google, Mistral, Groq.
- Capability requirements remain strict.
- Provider/model IDs remain implementation details behind Moonex profiles.
- Fallback never replays partial assistant output.

## Phase P0 — Reliability
- Streaming lifecycle, disconnects, empty streams, heartbeats, upstream errors.
- Bounded fallback and retry classification.
- Request/message/attachment limits and timeouts.
- Regression coverage across all 9 profiles.
- Production diagnostics and latency telemetry.

## Phase P1 — Core capabilities
- Vision and attachment reliability.
- Research/search and grounding sources.
- Code workflows.
- Context management and compaction.
- Edit/regenerate/retry state integrity.

## Phase P2 — Intelligent engine
- Auto Router V2 hardening.
- Provider health scoring.
- Capability + quality + latency routing.
- Adaptive fallback ordering within profile constraints.

## Phase P3 — Frontend
- Fast perceived response and smooth streaming.
- Markdown/code rendering and message actions.
- Attachment previews and processing state.
- Research source cards.
- History/search/persistence.
- Mobile and accessibility polish.

## Phase P4 — Scale
- Safe caching and provider health TTLs.
- Concurrency and abuse controls.
- Streaming benchmarks.
- Load/regression testing.

## Definition of done
Any Moonex profile should deliver its intended capability even when an individual provider/model is degraded. Failures should recover transparently when safe, streams should remain stable, and provider complexity should not leak into the product experience.
