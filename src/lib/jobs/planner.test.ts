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

test("clip-only Seedance request uses 1.5 Pro at 480p silent and omits last frame when none is given", () => {
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
  assert.deepEqual(both.frameImages, [
    { image: "https://example.com/start.png", frameType: "first_frame" },
    { image: "https://example.com/end.jpg", frameType: "last_frame" },
  ]);
});
