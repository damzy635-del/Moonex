# Supabase post-migration verification

**Verification date:** 2026-10-15  
**Project:** Moonex (`ubtsszlprzomjlzjnjle`)  
**Scope:** Read-only checks after the owner reported all SQL migrations had been applied. No database writes were performed in this verification.

## Migration ledger

The live Supabase migration ledger now contains:

- `0001 initial_schema`
- `20261013000000 auth_conversations`
- `20261013010000 reconcile_chat_ownership`
- `20261013020000 restrict_rls_event_function`
- `20261013030000 lock_down_payment_events`
- `20261014010000 query_performance_hardening`
- `20261014020000 least_privilege_public_table_grants`

This confirms that these versions are recorded in the live migration ledger. It does not, by itself, prove that every intended DDL effect is present; effective privileges and schema state must be checked separately.

## Positive checks

- All seven public application tables reported RLS enabled.
- Chat ownership composite FK `messages_conversation_user_fk` exists from `messages(conversation_id, user_id)` to `conversations(id, user_id)`.
- Effective privilege checks returned false for:
  - `anon` selecting `public.conversations`
  - `anon` inserting into `public.conversations`
  - `authenticated` truncating `public.conversations`
  - `authenticated` deleting from `public.profiles`
- `payment_events` has RLS enabled and no client-facing policy, consistent with keeping it server-only.

## Remaining security finding: function ACL

Supabase's security advisor still reports `public.rls_auto_enable()` as an externally executable `SECURITY DEFINER` function. A read-only inspection confirmed its ACL still includes `anon` and `authenticated` execute privileges, and `has_function_privilege` returns true for both roles.

The function definition identifies it as a PostgreSQL `event_trigger` callback, not a normal application RPC. That reduces the likelihood of ordinary PostgREST invocation, but it does not justify leaving its ACL inconsistent with the repository migration's intent. The migration `20261013020000_restrict_rls_event_function.sql` is recorded, yet the live ACL check does not reflect the expected revocation.

**Action required:** review why the recorded migration's intended function ACL change is not reflected live. Prepare a narrow corrective migration or approved database change, then re-check `has_function_privilege` and the Supabase advisor. No corrective DDL was executed during this audit.

## Advisor status

- **Security:** the function ACL warning remains. Leaked-password protection remains disabled because of the current plan limitation. The `payment_events` RLS-without-policy notice is informational for a server-only table.
- **Performance:** five indexes are reported unused. This is not sufficient evidence to drop them; workload may be small and the indexes may be needed as traffic grows.

## Important limitations

- The table inventory showed 2 conversations and 6 messages at the time of this check. Counts can change normally and are not data-integrity tests.
- Live authenticated per-user rate-limit behavior is still not verified by a real authenticated request sequence.
- Live authenticated Research-profile behavior is still not verified.
- Payment checkout, webhook signature verification, idempotency, and entitlement lifecycle remain unimplemented; do not accept real payments yet.

## Next sequence

1. Resolve the function ACL discrepancy with an explicit, reviewed narrow change.
2. Re-run effective grant and function-privilege checks, then the Supabase security advisor.
3. Run deployed authenticated rate-limit and Research checks when a valid test session is available.
4. Keep payments marked not ready until a provider integration and its tests are implemented.
