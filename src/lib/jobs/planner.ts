import { createContactBoxClient, plannerModel } from "@/lib/contactbox";
import { I2V_SUFFIX } from "@/lib/seedance";
import { CLIP_SECONDS, FINAL_SECONDS, SCENE_COUNT, sceneOrder } from "@/lib/jobs/pipeline";

export type PlannedScene = {
  sceneNumber: number;
  purpose: string;
  durationSec: number;
  whatViewerSees: string;
  curiosity: string;
  evidenceStyle: string;
  startPrompt: string;
  endPrompt: string;
  i2vPrompt: string;
};

export type HookPlan = {
  sceneCount: 3;
  whyThisStructure: string;
  evidenceStyle: string;
  scenes: PlannedScene[];
  voiceover: {
    language: string;
    languageWhy: string;
    lines: string[];
  };
  editNotes: {
    clipOrder: number[];
    soundDesign: string;
    overlayText: string[];
    finalTiming: string;
  };
};

const SYSTEM = `You are a senior YouTube mystery-documentary hook designer.
Create a realistic 3-scene hook footage plan. The backend ALWAYS makes exactly 3 scenes, 2 frames each, then 3 silent 4-second clips, then one 12-second assemble. Never plan 2 scenes. Never plan voiceover.

Feel: real, low-quality, believable, old POV / camcorder / bodycam / CCTV / expedition footage, early 2000s or rough field-recording when appropriate.
Must NOT look like polished AI art, fantasy, or cinematic trailer shots.

Choose footage type that fits: deployment, monitor/telemetry, POV search, partial reveal, lab/archive, aftermath / cut recording.

Rules:
- Alleged recovered evidence, not polished movie footage.
- Partial reveal, not fully explained.
- No fantasy, glow, sci-fi, ultra-sharp glossy, dramatic cinematic lighting, clean VFX, obvious AI composition.
- Practical and recordable in real life.
- Create a question in the viewer's mind.
- Do not force text overlays inside image prompts. Suggest overlays only in edit notes.
- No voiceover. Silent clips only.

Global style for ALL image prompts:
low-resolution recovered footage, old camera look, soft focus, practical framing, imperfect composition, mild motion blur, mild sensor noise, compression artifacts, slightly dirty lens, muted colors, weak practical light, documentary realism, no readable text, no logos, no fake futuristic UI.
If underwater: blue-green murk, suspended particles, sediment haze, weak ROV light, imperfect visibility.
If archival/indoor: camcorder look, tape softness, low dynamic range, rough white balance, dim room light, old monitor glow.

Decision rules:
- Title words found/captured/recorded/detected/seen/revealed/caught on camera → prefer a monitor/proof scene.
- Locations trench/cave/tomb/tunnel/temple/ocean/lake/shipwreck/ruins/pyramid/bunker/archive → POV search or deployment.
- something living/creature/not human/moving/appeared/entity → partial reveal, do not show the subject clearly.
- scientists/researchers/expedition/declassified/analysis → source footage + monitor + reveal.
- object or historical discovery → consider lab/archive after discovery.

Each scene needs TWO image prompts: start frame and end frame. They must be the same scene with only a small practical change (camera drift, focus hunt, light shift, subject slightly closer/farther). Not a new location.

Return ONLY JSON with this shape:
{
  "sceneCount": 3,
  "whyThisStructure": string,
  "evidenceStyle": string,
  "scenes": [{
    "sceneNumber": number,
    "purpose": string,
    "durationSec": 4,
    "whatViewerSees": string,
    "curiosity": string,
    "evidenceStyle": string,
    "startPrompt": string,
    "endPrompt": string,
    "i2vPrompt": string
  }],
  "editNotes": {
    "clipOrder": [1, 2, 3],
    "soundDesign": string,
    "overlayText": string[],
    "finalTiming": "12 seconds (3 × 4s silent Seedance 1.5 Pro 480p clips)"
  }
}

Image prompts must be detailed, 16:9, photoreal recovered footage.
i2vPrompt must tell the model to preserve the exact start frame, animate toward the end frame, and only animate subtle believable movement.
Always return exactly 3 scenes. clipOrder must be 1,2,3.`;

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export async function planHook(input: {
  title: string;
  script?: string | null;
}): Promise<HookPlan> {
  const client = createContactBoxClient();
  const user = `Title: ${input.title}

Script/topic (optional):
${input.script?.trim() || "(none — plan from the title only)"}

Use attached-style recovered-footage realism: low-resolution camera, imperfect framing, weak practical lighting, blur, compression, old footage texture, documentary evidence feeling. Do not copy any specific photo. Do not make it cinematic, glossy, fantasy, or AI-looking. Each scene should feel accidentally captured by a real expedition camera, ROV, CCTV, camcorder, monitor recording, or bodycam.`;

  const completion = await client.chat.completions.create({
    model: plannerModel(),
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });

  const text = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  }

  const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const sceneCount = SCENE_COUNT;

  const scenes: PlannedScene[] = rawScenes.slice(0, sceneCount).map((raw, i) => {
    const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
      sceneNumber: i + 1,
      purpose: asString(s.purpose, `Scene ${i + 1}`),
      durationSec: CLIP_SECONDS,
      whatViewerSees: asString(s.whatViewerSees),
      curiosity: asString(s.curiosity),
      evidenceStyle: asString(s.evidenceStyle, asString(parsed.evidenceStyle, "POV search")),
      startPrompt: asString(s.startPrompt),
      endPrompt: asString(s.endPrompt || s.startPrompt),
      i2vPrompt: asString(s.i2vPrompt) || I2V_SUFFIX,
    };
  });

  while (scenes.length < sceneCount) {
    const n = scenes.length + 1;
    scenes.push({
      sceneNumber: n,
      purpose: "Partial reveal",
      durationSec: CLIP_SECONDS,
      whatViewerSees: "A closer, still-unclear recovered frame.",
      curiosity: "What is just out of focus?",
      evidenceStyle: "partial reveal",
      startPrompt: `Low-resolution recovered 16:9 documentary still for: ${input.title}. Old camcorder, soft focus, dirty lens, muted colors, no readable text.`,
      endPrompt: `Same recovered 16:9 camcorder scene for: ${input.title}, slightly closer, still unclear, old footage texture, no readable text.`,
      i2vPrompt: I2V_SUFFIX,
    });
  }

  const notes = parsed.editNotes && typeof parsed.editNotes === "object"
    ? (parsed.editNotes as Record<string, unknown>)
    : {};

  return {
    sceneCount,
    whyThisStructure: asString(parsed.whyThisStructure, "Three recovered beats: setup, closer look, partial reveal."),
    evidenceStyle: asString(parsed.evidenceStyle, "recovered expedition footage"),
    scenes,
    voiceover: {
      language: "none",
      languageWhy: "Silent assemble. No voiceover.",
      lines: [],
    },
    editNotes: {
      clipOrder: sceneOrder(),
      soundDesign: asString(notes.soundDesign, "Room tone, tape hiss, no music sting."),
      overlayText: Array.isArray(notes.overlayText) ? notes.overlayText.map((t) => String(t)) : [],
      finalTiming: asString(notes.finalTiming, `${FINAL_SECONDS} seconds (${SCENE_COUNT} × ${CLIP_SECONDS}s silent Seedance clips).`),
    },
  };
}

export function voiceoverScript(plan: HookPlan): string {
  return plan.voiceover.lines.join(" ");
}
