# Hook clip factory

Every job is an **18-second silent clip**: 3 scenes × 2 frames → 3 clips → concat.

- **GPT Image 2** via **ElevenLabs** (`POST /v1/flows/image`, `model_id: gpt-image-2`)
- **Seedance 1.5 Pro** via **Fal** (`fal-ai/bytedance/seedance/v1.5/pro/image-to-video`) — ElevenLabs Flows does not expose Seedance 1.5 Pro (only Seedance 2 / 2.5)
- Planning still uses ContactBox GPT 5.6
- No voiceover

Live: [hook-clip-factory-production.up.railway.app](https://hook-clip-factory-production.up.railway.app)
