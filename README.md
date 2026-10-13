# Moonex clean-slate rebuild

Fresh React, TypeScript, Vite and Express foundation. Legacy source remains preserved on `p0-audit-baseline`.

## Supabase setup

1. Create or select a Supabase project.
2. Run `supabase/migrations/20261013000000_auth_conversations.sql` in the Supabase SQL Editor, or apply it with the Supabase CLI.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend environment. The publishable key is intended for browser use; never put a service-role/secret key in a `VITE_*` variable.
4. Configure email authentication and allowed redirect URLs in Supabase Auth settings.
5. Run `npm run dev` and test account creation, sign-in, and conversation history.

The browser talks to Supabase using the publishable key and relies on row-level security (RLS) for row ownership. This feature does not use the service-role key. AI responses remain a placeholder until provider routing is implemented.
