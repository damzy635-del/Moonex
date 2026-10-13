# Moonex clean-slate rebuild

Fresh React, TypeScript, Vite and Express foundation. Legacy source remains preserved on `p0-audit-baseline`.

## Supabase setup

1. Create or select a Supabase project.
2. Run `supabase/migrations/20261013000000_auth_conversations.sql` in the Supabase SQL Editor, or apply it with the Supabase CLI.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend environment. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the server runtime, or use the same URL and publishable key in both places.
4. Configure email authentication and allowed redirect URLs in Supabase Auth settings.
5. Never place a Supabase service-role/secret key in a `VITE_*` variable. The browser uses a publishable key and relies on RLS for data access.

## Live AI chat

- The chat API is available at `POST /api/v1/chat` locally and on Vercel. It verifies the caller's Supabase access token before contacting the provider.
- Add `OPENAI_API_KEY` as a server-side environment variable. Do not expose it to the browser or use a `VITE_*` prefix.
- Supported text profiles currently route to the configured OpenAI API: Lite/Fast to `gpt-6-luna`, Pro to `gpt-6-sol`, Pro Max/Ultra/Reasoning to `gpt-6-astra`, and Code to `gpt-5.3-codex`.
- Vision and Research currently return a clear capability-not-configured response until image input and web-search adapters are implemented.
- The endpoint streams Server-Sent Events and stores user/assistant messages in the user's conversation under RLS. Provider keys remain server-side.

## Local development

Run `npm install`, copy `.env.example` to `.env`, fill the required environment variables, then run `npm run dev`. The Vite client proxies `/api` to the local Express server.
