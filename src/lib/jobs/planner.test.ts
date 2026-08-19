import test from "node:test";
import assert from "node:assert/strict";
import { seedanceRequest, withI2vSuffix, I2V_SUFFIX } from "../seedance";

test("appends recovered-footage suffix once", () => {
  const once = withI2vSuffix("Slow ROV drift through murk.");
  assert.ok(once.includes("Slow ROV drift"));
  assert.ok(once.includes("exact reference frame"));
  const twice = withI2vSuffix(once);
  assert.equal(twice.split(I2V_SUFFIX).length, 2);
});

test("Seedance request uses 1.5 Pro at true 480p silent and always animates from a single first frame", () => {
  const startOnly = seedanceRequest({
    prompt: "Slow pan across the still.",
    startImageUrl: "https://example.com/start.png",
  });
  assert.equal(startOnly.model, "bytedance/seedance-v1.5-pro");
  assert.equal(startOnly.duration, 4);
  assert.equal(startOnly.resolution, "854x480");
  assert.equal(startOnly.generateAudio, false);
  assert.equal(startOnly.aspectRatio, "16:9");
  assert.deepEqual(startOnly.frameImages, [{ image: "https://example.com/start.png", frameType: "first_frame" }]);

  const both = seedanceRequest({
    prompt: "Cut on action.",
    startImageUrl: "https://example.com/start.png",
    endImageUrl: "https://example.com/end.jpg",
  });
  // Sending a last_frame flips the provider into flf2v mode, which rejects 480p, so the end still
  // is intentionally never sent to the video model — only described in the prompt text.
  assert.deepEqual(both.frameImages, [{ image: "https://example.com/start.png", frameType: "first_frame" }]);
});
