import assert from "node:assert/strict";
import test from "node:test";
import { estimateJob } from "./estimate";

test("matches live Railway estimate for 22 assets", () => {
  const estimate = estimateJob({ assetCount: 22, referenceCount: 0 });
  assert.equal(estimate.assetCount, 22);
  assert.equal(estimate.imageConcurrency, 5);
  assert.equal(estimate.imageBatches, 5);
  assert.equal(estimate.reasoningCostUsd, 0.04);
  assert.equal(estimate.imageCreditsPerImage, 50);
  assert.equal(estimate.imageCreditsTotal, 1100);
  assert.equal(estimate.imageCostUsd, 1.1);
  assert.equal(estimate.totalCostUsd, 1.14);
  assert.equal(estimate.reasoningSeconds, 55);
  assert.equal(estimate.imageSeconds, 110);
  assert.equal(estimate.totalSeconds, 165);
  assert.equal(estimate.totalMinutes, 2.8);
  assert.match(estimate.breakdown, /22 images/);
  assert.match(estimate.breakdown, /50 credits/);
  assert.match(estimate.breakdown, /1100 credits/);
});

test("clamps asset count to 1–25", () => {
  assert.equal(estimateJob({ assetCount: 0 }).assetCount, 1);
  assert.equal(estimateJob({ assetCount: 99 }).assetCount, 25);
});
