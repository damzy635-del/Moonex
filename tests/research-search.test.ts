import test from "node:test";
import assert from "node:assert/strict";
import { searchWeb } from "../server/research-search.ts";

test("searchWeb sends a bounded query and returns only valid deduplicated web sources", async () => {
  let sent: Record<string, unknown> | undefined;
  const result = await searchWeb("  latest TypeScript release  ", "secret", AbortSignal.timeout(1000), async (_url, init) => {
    sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ results: [
      { title: "Release notes", url: "https://example.com/release", content: "Version information" },
      { title: "Duplicate", url: "https://example.com/release", content: "Duplicate source" },
      { title: "Unsafe scheme", url: "javascript:alert(1)", content: "No" },
      { title: "Missing content", url: "https://example.com/empty", content: "" },
      { title: "Second source", url: "https://example.org/news", content: "Recent news" },
    ] }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  assert.equal(sent?.query, "latest TypeScript release");
  assert.equal(sent?.api_key, "secret");
  assert.equal(sent?.max_results, 5);
  assert.deepEqual(result, [
    { title: "Release notes", url: "https://example.com/release", content: "Version information" },
    { title: "Second source", url: "https://example.org/news", content: "Recent news" },
  ]);
});

test("searchWeb limits query and excerpt size", async () => {
  let sentQuery = "";
  const result = await searchWeb("x".repeat(2500), "secret", AbortSignal.timeout(1000), async (_url, init) => {
    sentQuery = (JSON.parse(String(init?.body)) as { query: string }).query;
    return new Response(JSON.stringify({ results: [
      { title: "A".repeat(500), url: "https://example.com", content: "B".repeat(5000) },
    ] }), { status: 200 });
  });
  assert.equal(sentQuery.length, 2000);
  assert.equal(result[0].title.length, 300);
  assert.equal(result[0].content.length, 4000);
});

test("searchWeb rejects empty queries and upstream failures", async () => {
  await assert.rejects(() => searchWeb("  ", "secret"), /empty/i);
  await assert.rejects(() => searchWeb("query", "secret", AbortSignal.timeout(1000), async () => new Response("", { status: 429 })), /status 429/i);
});
