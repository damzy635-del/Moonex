import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("chat handler aborts before contacting the provider if the response is already closed", async () => {
  const source = await readFile(new URL("../server/chat-handler.ts", import.meta.url), "utf8");
  const listener = source.indexOf('response.on?.("close", abortIfClientDisconnected)');
  const immediateCheck = source.indexOf("abortIfClientDisconnected();", listener);
  const abortedGuard = source.indexOf("if (clientAbort.signal.aborted)", immediateCheck);
  const providerFetch = source.indexOf("upstream = await fetch(", abortedGuard);
  assert.notEqual(listener, -1, "close listener should be registered");
  assert.ok(immediateCheck > listener, "disconnect state should be checked immediately after listener registration");
  assert.ok(abortedGuard > immediateCheck, "an already-aborted request should return early");
  assert.ok(providerFetch > abortedGuard, "provider fetch must happen only after the early-abort guard");
  assert.match(source.slice(abortedGuard, providerFetch), /response\.off\?\.\("close", abortIfClientDisconnected\)[\s\S]*?return;/);
});
