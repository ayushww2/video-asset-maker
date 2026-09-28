import assert from "node:assert/strict";
import test from "node:test";
import { estimateJob } from "./estimate";

test("matches live Railway estimate for 22 assets", () => {
  const estimate = estimateJob({ assetCount: 22, referenceCount: 0 });
  assert.equal(estimate.assetCount, 22);
  assert.equal(estimate.imageConcurrency, 5);
  assert.equal(estimate.imageBatches, 5);
  assert.equal(estimate.reasoningCostUsd, 0.04);
  assert.equal(estimate.imageCostUsd, 0.132);
  assert.equal(estimate.totalCostUsd, 0.172);
  assert.equal(estimate.reasoningSeconds, 55);
  assert.equal(estimate.imageSeconds, 110);
  assert.equal(estimate.totalSeconds, 165);
  assert.equal(estimate.totalMinutes, 2.8);
  assert.match(estimate.breakdown, /22 images/);
  assert.match(estimate.breakdown, /\$0\.172/);
});

test("clamps asset count to 1–25", () => {
  assert.equal(estimateJob({ assetCount: 0 }).assetCount, 1);
  assert.equal(estimateJob({ assetCount: 99 }).assetCount, 25);
});
