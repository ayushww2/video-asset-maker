import { createContactBoxClient, plannerModel } from "@/lib/contactbox";
import { withI2vSuffix } from "@/lib/seedance";

export type FrameAnalysis = {
  realismNotes: string;
  motionAdvice: string;
  refinedI2vPrompt: string;
};

export async function analyzeStartEndFrames(input: {
  title: string;
  sceneNumber: number;
  evidenceStyle: string;
  startImageUrl: string;
  endImageUrl: string;
  draftI2vPrompt: string;
}): Promise<FrameAnalysis> {
  const client = createContactBoxClient();
  const completion = await client.chat.completions.create({
    model: plannerModel(),
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You scan start-frame and end-frame stills for a YouTube mystery hook.
Return JSON: {"realismNotes": string, "motionAdvice": string, "refinedI2vPrompt": string}
refinedI2vPrompt must preserve the exact uploaded start frame, animate only toward the end frame, keep recovered-footage realism, and include no new objects, no readable text, no cinematic look.
Scene type: ${input.evidenceStyle}. Clip length: 6 seconds, 480p, silent.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Title: ${input.title}\nScene ${input.sceneNumber}\nDraft I2V prompt:\n${input.draftI2vPrompt}` },
          { type: "image_url", image_url: { url: input.startImageUrl } },
          { type: "image_url", image_url: { url: input.endImageUrl } },
        ],
      },
    ],
  });
  const text = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  const refined = String(parsed.refinedI2vPrompt || input.draftI2vPrompt);
  return {
    realismNotes: String(parsed.realismNotes || ""),
    motionAdvice: String(parsed.motionAdvice || ""),
    refinedI2vPrompt: withI2vSuffix(refined),
  };
}

export async function analyzeAssembly(input: {
  title: string;
  sceneSummaries: string[];
}): Promise<{ clipOrder: number[]; reason: string; soundDesign: string; overlayText: string[] }> {
  const client = createContactBoxClient();
  const completion = await client.chat.completions.create({
    model: plannerModel(),
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are assembling a 3-scene (or 2-scene) recovered-footage YouTube hook.
Return JSON {"clipOrder": number[], "reason": string, "soundDesign": string, "overlayText": string[]}
clipOrder is scene numbers in the best edit order. Prefer 1,2,3 unless a different order is clearly stronger.`,
      },
      {
        role: "user",
        content: `Title: ${input.title}\nScenes:\n${input.sceneSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
      },
    ],
  });
  const text = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  const order = Array.isArray(parsed.clipOrder)
    ? parsed.clipOrder.map((n) => Number(n)).filter((n) => n > 0)
    : input.sceneSummaries.map((_, i) => i + 1);
  return {
    clipOrder: order.length ? order : input.sceneSummaries.map((_, i) => i + 1),
    reason: String(parsed.reason || "Keep chronological recovered-evidence order."),
    soundDesign: String(parsed.soundDesign || "Tape hiss, room tone, no trailer music."),
    overlayText: Array.isArray(parsed.overlayText) ? parsed.overlayText.map((t) => String(t)) : [],
  };
}
