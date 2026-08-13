export const SCENE_COUNT = 3;
export const CLIP_SECONDS = 4;
export const FINAL_SECONDS = SCENE_COUNT * CLIP_SECONDS;

export function hookProgressTotal(): number {
  return 1 + SCENE_COUNT * 4 + 1;
}

export function sceneOrder(): number[] {
  return Array.from({ length: SCENE_COUNT }, (_, i) => i + 1);
}
