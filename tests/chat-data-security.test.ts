import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL("../supabase/migrations/20261013000000_auth_conversations.sql", import.meta.url);

test("chat history tables enforce user ownership and valid content", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /user_id uuid not null references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /foreign key \(conversation_id, user_id\)\s+references public\.conversations\(id, user_id\) on delete cascade/i);
  assert.match(sql, /role text not null check \(role in \('user', 'assistant'\)\)/i);
  assert.match(sql, /char_length\(content\) between 1 and 100000/i);
});

test("RLS is enabled for both tables and ownership policies use auth.uid()", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter table public\.conversations enable row level security/i);
  assert.match(sql, /alter table public\.messages enable row level security/i);
  assert.match(sql, /on public\.conversations for select to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /on public\.messages for select to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /on public\.messages for insert to authenticated\s+with check \([\s\S]*?c\.id = conversation_id and c\.user_id = \(select auth\.uid\(\)\)/i);
});

test("authenticated grants do not allow message updates", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /grant select, insert, update, delete on public\.conversations to authenticated/i);
  assert.match(sql, /grant select, insert, delete on public\.messages to authenticated/i);
  assert.doesNotMatch(sql, /grant [^;]*update[^;]* on public\.messages to authenticated/i);
});
