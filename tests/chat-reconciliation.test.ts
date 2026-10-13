import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL("../supabase/migrations/20261013010000_reconcile_chat_ownership.sql", import.meta.url);

test("reconciliation refuses to mutate inconsistent ownership or invalid chat data", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /left join public\.conversations c on c\.id = m\.conversation_id[\s\S]*?c\.id is null or c\.user_id <> m\.user_id/i);
  assert.match(sql, /raise exception 'Moonex reconciliation blocked: orphaned or cross-owner messages exist/i);
  assert.match(sql, /invalid conversation titles exist/i);
  assert.match(sql, /invalid message role\/content exists/i);
});

test("reconciliation removes the permissive message catch-all and enforces composite ownership", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /drop policy if exists "messages own access" on public\.messages/i);
  assert.match(sql, /foreign key \(conversation_id, user_id\)\s+references public\.conversations\(id, user_id\)\s+on delete cascade/i);
  assert.match(sql, /alter table public\.messages enable row level security/i);
  assert.match(sql, /grant select, insert, delete on public\.messages to authenticated/i);
  assert.doesNotMatch(sql, /grant [^;]*update[^;]* on public\.messages to authenticated/i);
});

test("reconciliation preserves existing schema columns and never deletes or reassigns chat rows", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(sql, /\b(drop table|truncate|delete from|update public\.(conversations|messages))\b/i);
  assert.doesNotMatch(sql, /drop column/i);
});
