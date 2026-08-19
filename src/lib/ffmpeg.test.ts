import test from "node:test";
import assert from "node:assert/strict";
import { concatListContents } from "./ffmpeg";

test("builds ffmpeg concat list for 3 scenes", () => {
  const list = concatListContents(["/tmp/a.mp4", "/tmp/b.mp4", "/tmp/c.mp4"]);
  assert.equal(list, "file '/tmp/a.mp4'\nfile '/tmp/b.mp4'\nfile '/tmp/c.mp4'");
});
