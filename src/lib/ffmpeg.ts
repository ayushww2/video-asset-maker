import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { CLIP_SECONDS, FINAL_SECONDS, SCENE_COUNT } from "./jobs/pipeline";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => {
      err += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${err.slice(-800)}`));
    });
  });
}

export function concatListContents(paths: string[]): string {
  return paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
}

export async function combineHookClips(input: { clipBuffers: Buffer[] }): Promise<Buffer> {
  if (input.clipBuffers.length !== SCENE_COUNT) {
    throw new Error(`Need exactly ${SCENE_COUNT} clips for a ${FINAL_SECONDS}s assemble`);
  }
  const dir = join(tmpdir(), `vam-hook-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  try {
    const normalized: string[] = [];
    for (let i = 0; i < input.clipBuffers.length; i++) {
      const src = join(dir, `raw-${i + 1}.mp4`);
      const out = join(dir, `scene-${i + 1}.mp4`);
      await writeFile(src, input.clipBuffers[i]);
      await run("ffmpeg", [
        "-y",
        "-i",
        src,
        "-t",
        String(CLIP_SECONDS),
        "-vf",
        `fps=24,scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=${CLIP_SECONDS},trim=duration=${CLIP_SECONDS},setpts=PTS-STARTPTS`,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        out,
      ]);
      normalized.push(out);
    }

    const listPath = join(dir, "list.txt");
    await writeFile(listPath, concatListContents(normalized));
    const concatPath = join(dir, "concat.mp4");
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", concatPath]);

    const outPath = join(dir, "final.mp4");
    await run("ffmpeg", [
      "-y",
      "-i",
      concatPath,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-t",
      String(FINAL_SECONDS),
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      outPath,
    ]);
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
