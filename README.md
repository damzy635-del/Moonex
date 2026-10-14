# Moonex clean-slate rebuild

Fresh React, TypeScript, Vite and Express foundation. Legacy source remains preserved on `p0-audit-baseline`.

## Supabase setup

1. Create or select the intended Supabase project.
2. Apply migrations in timestamp order from `supabase/migrations/`. Review each migration and verify the target project before applying it.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend environment. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the server runtime, or use the same URL and publishable key in both places.
4. Configure email authentication and allowed redirect URLs in Supabase Auth settings.
5. Never place a Supabase service-role/secret key in a `VITE_*` variable. The browser uses a publishable key and relies on RLS for data access.
6. Before applying ownership or constraint migrations to a database with existing data, take a backup and inspect the migration's validation checks. These migrations intentionally stop rather than silently reassign inconsistent records.

## Live AI chat

- The chat API is available at `POST /api/v1/chat` locally and on Vercel. It verifies the caller's Supabase access token before contacting the provider.
- Configure `GEMINI_API_KEY` as a server-side environment variable. `GOOGLE_API_KEY` is accepted as a fallback. Never use a `VITE_*` prefix for provider keys.
- `GEMINI_MODEL` optionally selects the fallback upstream Gemini model; the default is `gemini-3.1-flash-lite`. Confirm each selected model ID is available to your Google AI Studio project.
- Optional server-only overrides are `GEMINI_MODEL_LITE`, `GEMINI_MODEL_FAST`, `GEMINI_MODEL_PRO`, `GEMINI_MODEL_PRO_MAX`, `GEMINI_MODEL_ULTRA`, `GEMINI_MODEL_REASONING`, `GEMINI_MODEL_CODE`, `GEMINI_MODEL_RESEARCH`, and `GEMINI_MODEL_VISION`. Routing order is profile override → `GEMINI_MODEL` → default model. Never use a `VITE_*` prefix for these values.
- Lite, Fast, Pro, Pro Max, Ultra, Reasoning, and Code are Moonex product profiles with different response-style instructions; they are not separate Google model names.
- Research now performs a server-side Tavily web search and grounds the Gemini response in up to five validated results. Configure server-side `TAVILY_API_KEY` to enable it; results include source URLs and are treated as untrusted input. Vision accepts up to four JPEG, PNG, WebP, or GIF images (1 MB each; 3 MB combined) and sends them as inline Gemini image parts. Configure optional server-side `GEMINI_MODEL_VISION`; provider/model availability still needs live verification.
- The endpoint streams Server-Sent Events and stores user/assistant messages in the user's conversation under RLS. Provider keys remain server-side.

## Production environment checklist

Set these in the **server** environment before enabling live chat:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TAVILY_API_KEY` (required only if enabling Research)

The shared Upstash Redis limiter allows 10 chat requests per authenticated user per 60-second fixed window. In production, chat fails closed with HTTP 503 if shared rate limiting is not configured or cannot be reached. Do not remove this guard or replace it with process-local memory.

Also verify:
- Frontend `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` match the intended Supabase project.
- Supabase Auth redirect URLs and site URL match the deployed app.
- The deployed API has the same server environment variables and supports streaming responses.
- No secret keys are exposed in client bundles, committed files, or build logs.
- Run the CI typecheck, tests, and production build after every change.

## Known limitations before feature rollout

- Supabase leaked-password protection is currently disabled because it is unavailable on the project's current plan. This is a documented security limitation, not a release-blocking code change.
- Payment event table access is restricted by a migration, but payment webhook processing and its production configuration must be separately implemented and verified before accepting real payments.
- Database migrations and environment configuration must be verified against the live project; a successful CI run validates repository checks, not live database deployment.
- Vision input is implemented in the API and requires a valid Gemini model that supports image input. Research requires a valid Tavily API key and a Gemini model available to the configured Google AI Studio project; external provider behavior and deployed environment variables still need live verification.

## Local development

Run `npm install`, copy `.env.example` to `.env`, fill the required environment variables, then run `npm run dev`. The Vite client proxies `/api` to the local Express server.
