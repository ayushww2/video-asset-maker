import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

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

export async function combineHookClips(input: {
  clipBuffers: Buffer[];
  voiceover?: Buffer | null;
}): Promise<Buffer> {
  if (input.clipBuffers.length < 2) throw new Error("Need at least 2 clips to combine");
  const dir = join(tmpdir(), `vam-hook-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  try {
    const clipPaths: string[] = [];
    for (let i = 0; i < input.clipBuffers.length; i++) {
      const path = join(dir, `scene-${i + 1}.mp4`);
      await writeFile(path, input.clipBuffers[i]);
      clipPaths.push(path);
    }
    const listPath = join(dir, "list.txt");
    await writeFile(listPath, concatListContents(clipPaths));
    const concatPath = join(dir, "concat.mp4");
    await run("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      concatPath,
    ]);

    const outPath = join(dir, "final.mp4");
    if (input.voiceover && input.voiceover.length > 0) {
      const voPath = join(dir, "vo.mp3");
      await writeFile(voPath, input.voiceover);
      await run("ffmpeg", [
        "-y",
        "-i",
        concatPath,
        "-i",
        voPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        outPath,
      ]);
    } else {
      await run("ffmpeg", [
        "-y",
        "-i",
        concatPath,
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-shortest",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        outPath,
      ]);
    }
    const { readFile } = await import("node:fs/promises");
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
