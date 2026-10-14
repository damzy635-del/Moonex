# Supabase live-schema reconciliation

Status: read-only inventory captured 2026-10-14. This note is not an assertion that live schema matches repository migrations.

## Safety

- Project: Moonex (`ubtsszlprzomjlzjnjle`), PostgreSQL 17.11, region `us-east-1`.
- All work remains on `rebuild/moonex-clean-slate`; do not merge into `main`.
- No live DDL or migration was applied during this inventory.
- The Supabase migration ledger returned no entries although public application tables and data already exist. Treat this as an externally/manual provisioned schema until provenance is established.
- Do not run the whole migration directory or mark historical migrations applied just to populate the ledger.

## Live inventory

All seven listed public tables have RLS enabled.

| Table | Snapshot rows | Key schema facts |
|---|---:|---|
| `profiles` | 0 | UUID PK; `id` FK to `auth.users`; display name, locale, timestamps |
| `conversations` | 10 | UUID PK; `user_id` FK to auth users; title/model profile defaults; timestamps |
| `messages` | 93 | UUID PK; conversation/user IDs; role check limited to user/assistant/system; content and optional provider/token metadata |
| `usage_events` | 0 | UUID PK; optional user/provider/token fields; profile ID, status, timestamp |
| `plans` | 0 | Text PK; name, active flag, JSONB features, timestamp |
| `subscriptions` | 0 | UUID PK; user and plan FKs; provider IDs, status default `incomplete`, period end and timestamps |
| `payment_events` | 0 | UUID PK; provider/event IDs, event type, JSONB payload, processed/created timestamps |

Counts are a snapshot, not a permanent invariant. Do not infer that empty tables are disposable.

## Read-only comparison: live objects vs repository migrations

| Migration | Observed status | Assessment |
|---|---|---|
| `0001_initial_schema.sql` | Tables and many base objects exist, but live schema has evolved | **Not safe as a baseline/replay.** It uses `CREATE TABLE IF NOT EXISTS`, which does not reconcile definitions, and attempts to create broad legacy policies such as `conversations own access` and `messages own access`. Do not replay it against live. |
| `20261013000000_auth_conversations.sql` | Chat tables, owner policies, indexes, and composite unique/FK exist | **Not equivalent.** Migration's title check (1–200 chars), message content length check (1–100000), and role constraint (`user`,`assistant`) do not match live: live role constraint permits `system`, and title/content checks were not present in the inspected constraints. Do not apply blindly; the constraints are a product/data compatibility decision. |
| `20261013010000_reconcile_chat_ownership.sql` | Composite unique/FK and expected strict message policies exist; old catch-all message policy was not returned in policy inventory | Most ownership changes appear already reflected. Its data preflight is useful, but it does not fully converge title/content checks. Review exact live policy and FK names before use. |
| `20261013020000_restrict_rls_event_function.sql` | `public.rls_auto_enable()` exists as SECURITY DEFINER with `search_path=pg_catalog`; no public-schema triggers were returned | **Targeted check required.** Function exists, but this inventory has not established its event-trigger attachment or effective EXECUTE grants. Confirm those before applying the revoke migration. |
| `20261013030000_lock_down_payment_events.sql` | No `anon` or `authenticated` table grants were returned for `payment_events`; `service_role` retains privileges | Intended outcome appears already achieved. Reconfirm grants at execution time; avoid needless production mutation. |
| `20261014010000_query_performance_hardening.sql` | All five named indexes exist. The duplicate `conversations own access` policy was not returned. The four policy definitions use scalar subqueries for `auth.uid()` | Index and policy changes appear substantially reflected. Check the exact four policies and index definitions before considering the migration redundant/complete. |
| `20261014020000_least_privilege_public_table_grants.sql` | Broad `anon`/`authenticated` privileges remain on six tables; `payment_events` is already restricted | **Not yet applied / desired state differs.** It removes broad privileges and re-grants a narrower set. This can change client behavior, so review every client-side Supabase operation and test before applying. |

### Ownership and constraints

- `messages_conversation_user_fk` links `messages(conversation_id, user_id)` to `conversations(id, user_id)`, supporting same-owner message integrity. Preserve this unless a reviewed migration explicitly replaces it.
- Live indexes observed: `conversations_user_updated_idx`, `messages_conversation_created_idx`, `messages_conversation_user_idx`, `messages_user_id_idx`, `subscriptions_plan_id_idx`, `subscriptions_user_id_idx`, and `usage_events_user_id_idx`, plus primary/unique indexes.
- No triggers were returned from `information_schema.triggers` for `public`. This query does not establish whether event triggers exist, because PostgreSQL event triggers are catalogued separately.
- `public.rls_auto_enable()` exists as a SECURITY DEFINER event-trigger callback and sets `search_path` to `pg_catalog`. Confirm event-trigger attachment and EXECUTE grants in a separate read-only check.
- Live policies are owner-scoped for conversations/messages/profiles/subscriptions/usage; plans are readable by authenticated users when active. `payment_events` has no client-facing policy.
- Broad `anon` and `authenticated` privileges were observed for `profiles`, `conversations`, `messages`, `plans`, `subscriptions`, and `usage_events`. RLS does not replace least-privilege grants.
- The repository's least-privilege grants migration is committed but has not been applied live. Review client query patterns and service-role usage first.
- Leaked-password protection is a known disabled setting due to current plan limitations; do not confuse that limitation with migration readiness.

## Safe migration-baseline procedure

1. Freeze schema writes during the baseline window so dashboard edits and migration-based edits cannot race.
2. Capture a restorable backup/PITR checkpoint and verify restore options before schema changes.
3. Export authoritative DDL for all public tables: columns/defaults, PK/FK/unique/check constraints, indexes, triggers, functions, grants, RLS flags and policy expressions. Capture event triggers and dependencies separately; never commit secrets or row payloads.
4. Compare live DDL against each repository migration chronologically. Classify each operation as equivalent/already present, absent/safe, conflicting/drifted, or destructive/manual review.
5. Create a reviewed baseline only after complete live DDL and repository history are reconciled. It must represent the intended starting schema, not just list existing filenames.
6. Rehearse migration ordering and effects on a disposable database restored from backup/baseline. Verify constraints, policies, grants and application tests.
7. Apply only an explicitly scoped, approved production change set in a maintenance window with a restore plan. `IF NOT EXISTS` is not a substitute for definition comparison.
8. Verify the ledger, schema, policies and grants after the change and record the migration commit SHA.

## Remaining gaps

- Exact live column checks/defaults beyond the inspected constraints, event-trigger attachment, and effective function grants need confirmation.
- The empty migration ledger's provenance remains unresolved.
- Live authenticated rate-limit and Research-profile requests have not been verified.
- Payment processing is not implemented. Billing tables do not imply checkout, webhook verification, idempotency, or entitlement enforcement are ready.

## Decision

Do not apply migrations to production yet. The comparison found concrete drift, especially title/content checks and grants. Complete event-trigger/grant inspection, review client query patterns, rehearse the exact change set on a disposable database, then request explicit approval before any production application.