# Hook clip factory

Every job is a **12-second silent clip**: 3 scenes × 2 frames → 3 clips × 4s → concat.

- **GPT Image 2** via **ElevenLabs** (`POST /v1/flows/image`, `model_id: gpt-image-2`)
- **Seedance 2.0 Mini** via **ElevenLabs** (`POST /v1/flows/video`, `model_id: bytedance-seedance-v2-mini`, **480p**, silent, **4s**). The Railway worker runs in **EU (Netherlands)** because Seedance 2 is blocked from US IPs. Isolated residency APIs (`api.eu.residency.elevenlabs.io`) need a separate key and do not work with this account.
- Planning still uses ContactBox GPT 5.6
- No voiceover

Live: [hook-clip-factory-production.up.railway.app](https://hook-clip-factory-production.up.railway.app)
