import test from "node:test";
import assert from "node:assert/strict";
import { withI2vSuffix, I2V_SUFFIX } from "../seedance";

test("appends recovered-footage suffix once", () => {
  const once = withI2vSuffix("Slow ROV drift through murk.");
  assert.ok(once.includes("Slow ROV drift"));
  assert.ok(once.includes("exact reference frame"));
  const twice = withI2vSuffix(once);
  assert.equal(twice.split(I2V_SUFFIX).length, 2);
});
