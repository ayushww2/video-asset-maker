import test from "node:test";
import assert from "node:assert/strict";
import { concatListContents } from "./ffmpeg";

test("builds ffmpeg concat list", () => {
  const list = concatListContents(["/tmp/a.mp4", "/tmp/b.mp4"]);
  assert.equal(list, "file '/tmp/a.mp4'\nfile '/tmp/b.mp4'");
});
