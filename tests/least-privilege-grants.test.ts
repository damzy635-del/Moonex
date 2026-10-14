import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("least-privilege migration revokes anonymous access and limits authenticated table grants", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261014020000_least_privilege_public_table_grants.sql", import.meta.url), "utf8");
  assert.match(sql, /revoke all privileges on table[\s\S]*?from anon/i);
  assert.match(sql, /revoke all privileges on table[\s\S]*?from authenticated/i);
  assert.match(sql, /grant select, update on table public\.profiles to authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.conversations to authenticated/i);
  assert.match(sql, /grant select, insert, delete on table public\.messages to authenticated/i);
  assert.match(sql, /grant select on table public\.(plans|subscriptions|usage_events) to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+[^;]*\bpayment_events\b/i);
  assert.doesNotMatch(sql, /\b(drop|truncate|delete from)\b/i);
});
