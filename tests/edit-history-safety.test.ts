import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("editing a prompt preserves original message rows until a replacement is saved", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /const replacedMessageIds = isEditing && active \? active\.messages\.slice\(editingIndex\)/);
  assert.doesNotMatch(source, /const removeIds = active\.messages\.slice\(editingIndex\)/);
  const assistantSave = source.indexOf('const { data: savedAssistant, error: saveAssistantError }');
  const cleanupAfterSave = source.indexOf("await removeReplacedMessages();", assistantSave);
  assert.ok(assistantSave >= 0 && cleanupAfterSave > assistantSave, "superseded messages are removed after assistant persistence");
});

test("failed or empty interrupted edits restore the original conversation in the UI", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /const restoreOriginalMessages = \(\) =>/);
  assert.match(source, /if \(isEditing && !assistantSaved\)/);
  assert.match(source, /restoreOriginalMessages\(\)/);
  assert.match(source, /replacementUserSaved && user && supabase && persisted/);
});

test("a successfully persisted partial response commits the replacement before removing old turns", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const interruptedSave = source.indexOf("const persistInterruptedResponse = async");
  const assistantSaved = source.indexOf("assistantSaved = true;", interruptedSave);
  const cleanup = source.indexOf("await removeReplacedMessages();", assistantSaved);
  assert.ok(interruptedSave >= 0 && assistantSaved > interruptedSave && cleanup > assistantSaved);
});
