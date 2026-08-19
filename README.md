# Hook clip factory

Every job is a **12-second silent clip**: 3 scenes × 2 frames → 3 clips × 4s → concat.

- **GPT Image 2** via **ElevenLabs** (`POST /v1/flows/image`, `model_id: gpt-image-2`)
- **Seedance 1.5 Pro** via **Vercel AI Gateway** (`bytedance/seedance-v1.5-pro`, **480p**, silent, **4s**, first + last frame)
- Planning still uses ContactBox GPT 5.6
- No voiceover

Live: [hook-clip-factory-production.up.railway.app](https://hook-clip-factory-production.up.railway.app)
