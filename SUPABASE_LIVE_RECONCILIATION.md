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

## Ownership and access findings

- `messages_conversation_user_fk` links `messages(conversation_id, user_id)` to `conversations(id, user_id)`, supporting same-owner message integrity. Preserve this unless a reviewed migration explicitly replaces it.
- Earlier audit observations found broad grants to `anon`/`authenticated` despite RLS. Review grants and policies together; RLS does not replace least-privilege grants.
- `payment_events` is intended to remain server-only. Do not add a permissive client policy.
- The repository's least-privilege grants migration is committed but has not been applied live. Review client query patterns and service-role usage first.
- Leaked-password protection is a known disabled setting due to current plan limitations; do not confuse that limitation with migration readiness.

## Safe migration-baseline procedure

1. Freeze schema writes during the baseline window so dashboard edits and migration-based edits cannot race.
2. Capture a restorable backup/PITR checkpoint and verify restore options before schema changes.
3. Export authoritative DDL for all public tables: columns/defaults, PK/FK/unique/check constraints, indexes, triggers, functions, grants, RLS flags and policy expressions. Capture dependencies separately; never commit secrets or row payloads.
4. Compare live DDL against each repository migration chronologically. Classify each operation as equivalent/already present, absent/safe, conflicting/drifted, or destructive/manual review.
5. Create a reviewed baseline only after complete live DDL and repository history are reconciled. It must represent the intended starting schema, not just list existing filenames.
6. Rehearse migration ordering and effects on a disposable database restored from backup/baseline. Verify constraints, policies, grants and application tests.
7. Apply only an explicitly scoped, approved production change set in a maintenance window with a restore plan. `IF NOT EXISTS` is not a substitute for definition comparison.
8. Verify the ledger, schema, policies and grants after the change and record the migration commit SHA.

## Not yet verified

- Complete policy expressions, effective grants, indexes, triggers and function definitions are not all captured here.
- The empty migration ledger's provenance remains unresolved.
- These migrations need line-by-line comparison with full live DDL before production application: `20261013010000_reconcile_chat_ownership.sql`, `20261013020000_restrict_rls_event_function.sql`, `20261013030000_lock_down_payment_events.sql`, `20261014010000_query_performance_hardening.sql`, and `20261014020000_least_privilege_public_table_grants.sql`.
- This does not claim a live authenticated rate-limit test or authenticated Research-profile request has passed.
- Payment processing is not implemented. The presence of billing tables does not imply checkout, webhooks, or entitlement enforcement are ready.

## Decision

Do not apply migrations to production yet. Finish the DDL export and migration-by-migration comparison, review the exact change set, then request explicit approval for any live application.