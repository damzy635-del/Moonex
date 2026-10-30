import test from "node:test";
import assert from "node:assert/strict";
import { resolveAutoProfile } from "../server/auto-router.ts";

test("auto routing prioritizes image capability", () => {
  assert.equal(resolveAutoProfile({prompt:"Explain this",hasImages:true}),"moonex-vision-1.5");
});
test("auto routing sends current information requests to Research", () => {
  assert.equal(resolveAutoProfile({prompt:"Research the latest AI regulation changes with sources"}),"moonex-research-1.5");
});
test("auto routing sends software tasks to Code", () => {
  assert.equal(resolveAutoProfile({prompt:"Debug this TypeScript React component"}),"moonex-code-1.5");
});
test("auto routing sends mathematical proofs to Reasoning", () => {
  assert.equal(resolveAutoProfile({prompt:"Prove this theorem step by step"}),"moonex-reasoning-1.5");
});
test("auto routing selects Fast for short requests and Pro by default", () => {
  assert.equal(resolveAutoProfile({prompt:"What is 2+2?"}),"moonex-fast-1.5");
  assert.equal(resolveAutoProfile({prompt:"Explain the trade-offs between relational and document databases."}),"moonex-pro-1.5");
});
test("auto routing selects deeper profiles for explicit depth", () => {
  assert.equal(resolveAutoProfile({prompt:"Give me a comprehensive deep dive into distributed systems architecture"}),"moonex-pro-max-1.5");
});
