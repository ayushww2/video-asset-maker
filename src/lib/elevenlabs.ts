export async function generateVoiceover(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY || "";
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "pqHfZKP75CvOlQylNhV4";
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2_5";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.15,
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs failed (${res.status}): ${body.slice(0, 240)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
