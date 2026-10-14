import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL("../supabase/migrations/20261014010000_query_performance_hardening.sql", import.meta.url);

test("adds indexes for uncovered foreign keys and owner-scoped queries", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const indexName of [
    "messages_conversation_user_idx",
    "messages_user_id_idx",
    "subscriptions_plan_id_idx",
    "subscriptions_user_id_idx",
    "usage_events_user_id_idx",
  ]) {
    assert.match(sql, new RegExp("create index if not exists " + indexName, "i"));
  }
});

test("removes duplicate conversation access and optimizes auth policy expressions", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /drop policy if exists "conversations own access" on public\.conversations/i);
  assert.match(sql, /id = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(sql, /drop table|truncate|delete from/i);
});
