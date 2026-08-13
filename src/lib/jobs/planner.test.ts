import test from "node:test";
import assert from "node:assert/strict";
import { seedanceRequestBody, withI2vSuffix, I2V_SUFFIX } from "../seedance";

test("appends recovered-footage suffix once", () => {
  const once = withI2vSuffix("Slow ROV drift through murk.");
  assert.ok(once.includes("Slow ROV drift"));
  assert.ok(once.includes("exact reference frame"));
  const twice = withI2vSuffix(once);
  assert.equal(twice.split(I2V_SUFFIX).length, 2);
});

test("clip-only Seedance body uses Mini at 480p and omits end frame when none is given", () => {
  const startFrame = {
    type: "inline_base64" as const,
    content_base64: "AAAA",
    mime_type: "image/png" as const,
  };
  const startOnly = seedanceRequestBody({
    prompt: "Slow pan across the still.",
    startFrame,
  });
  assert.equal(startOnly.model_id, "bytedance-seedance-v2-mini");
  assert.equal(startOnly.start_frame.content_base64, "AAAA");
  assert.equal("end_frame" in startOnly, false);
  assert.equal(startOnly.duration_secs, 4);
  assert.equal(startOnly.resolution, "480p");
  assert.equal(startOnly.generate_audio, false);
  assert.equal(startOnly.aspect_ratio, "16:9");

  const both = seedanceRequestBody({
    prompt: "Cut on action.",
    startFrame,
    endFrame: {
      type: "inline_base64",
      content_base64: "BBBB",
      mime_type: "image/jpeg",
    },
  });
  assert.equal(both.end_frame?.content_base64, "BBBB");
  assert.equal(both.end_frame?.mime_type, "image/jpeg");
});
