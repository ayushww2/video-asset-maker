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

test("clip-only Seedance body omits end frame when none is given", () => {
  const startOnly = seedanceRequestBody({
    prompt: "Slow pan across the still.",
    startImageUrl: "https://example.com/start.png",
  });
  assert.equal(startOnly.image_url, "https://example.com/start.png");
  assert.equal("end_image_url" in startOnly, false);
  assert.equal(startOnly.duration, "6");
  assert.equal(startOnly.resolution, "480p");
  assert.equal(startOnly.generate_audio, false);

  const both = seedanceRequestBody({
    prompt: "Cut on action.",
    startImageUrl: "https://example.com/start.png",
    endImageUrl: "https://example.com/end.png",
  });
  assert.equal(both.end_image_url, "https://example.com/end.png");
});
