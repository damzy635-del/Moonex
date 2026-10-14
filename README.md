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
- `GEMINI_MODEL` optionally selects the upstream Gemini model; the default is `gemini-3.1-flash-lite`. Confirm that the selected model is available to your Google AI Studio project.
- Lite, Fast, Pro, Pro Max, Ultra, Reasoning, and Code are Moonex product profiles. They currently use the configured Gemini model with different response-style instructions; they are not separate Google model names.
- Vision and Research return a capability-not-configured response until image input and web-search adapters are implemented.
- The endpoint streams Server-Sent Events and stores user/assistant messages in the user's conversation under RLS. Provider keys remain server-side.

## Production environment checklist

Set these in the **server** environment before enabling live chat:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

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
- Vision and Research capabilities are not implemented yet.

## Local development

Run `npm install`, copy `.env.example` to `.env`, fill the required environment variables, then run `npm run dev`. The Vite client proxies `/api` to the local Express server.
