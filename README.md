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
- Configure `GEMINI_API_KEY` as a server-side environment variable. `GOOGLE_API_KEY` is accepted as a fallback. Never use a `VITE_*` prefix for provider keys.
- `GEMINI_MODEL` optionally selects the upstream Gemini model; the default is `gemini-3.1-flash-lite`. Confirm that the selected model is available to your Google AI Studio project.
- Lite, Fast, Pro, Pro Max, Ultra, Reasoning, and Code are Moonex product profiles. They currently use the configured Gemini model with different response-style instructions; they are not separate Google model names.
- Vision and Research return a capability-not-configured response until image input and web-search adapters are implemented.
- The endpoint streams Server-Sent Events and stores user/assistant messages in the user's conversation under RLS. Provider keys remain server-side.

## Local development

Run `npm install`, copy `.env.example` to `.env`, fill the required environment variables, then run `npm run dev`. The Vite client proxies `/api` to the local Express server.
