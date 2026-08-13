import test from "node:test";
import assert from "node:assert/strict";
import { FINAL_SECONDS, SCENE_COUNT, hookProgressTotal, sceneOrder } from "./pipeline";

test("pipeline is locked to 3 scenes and 18 seconds", () => {
  assert.equal(SCENE_COUNT, 3);
  assert.equal(FINAL_SECONDS, 18);
  assert.deepEqual(sceneOrder(), [1, 2, 3]);
  assert.equal(hookProgressTotal(), 14);
});
