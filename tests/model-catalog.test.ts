import test from "node:test";
import assert from "node:assert/strict";
import {MODEL_PROFILES} from "../packages/model-catalog/index.ts";
test("public catalog contains exactly the nine Moonex profiles",()=>{assert.equal(MODEL_PROFILES.length,9);assert.deepEqual(MODEL_PROFILES.map(m=>m.id),["moonex-lite-1.5","moonex-fast-1.5","moonex-pro-1.5","moonex-pro-max-1.5","moonex-ultra-1.5","moonex-reasoning-1.5","moonex-code-1.5","moonex-vision-1.5","moonex-research-1.5"]);});