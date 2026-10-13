import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL("../supabase/migrations/20261013030000_lock_down_payment_events.sql", import.meta.url);

test("payment event records are not directly accessible to browser roles", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /revoke all privileges on table public\.payment_events from anon, authenticated/i);
  assert.doesNotMatch(sql, /grant\s+[^;]*\bon\s+public\.payment_events\s+to\s+(anon|authenticated)/i);
  assert.doesNotMatch(sql, /drop table|truncate|delete from|drop policy/i);
});
