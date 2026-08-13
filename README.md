# Hook clip factory

This repo is **not** the AI scenes image maker. Do **not** deploy it onto the existing Video Asset Maker Railway project (`video-asset-maker-production`). That service stays as the stills generator.

This app has two studio sections:

1. **Clips only** — upload or paste a start still (end still optional) + a motion prompt → **Seedance 1.5 Pro** 6s / 480p / silent clip. No GPT Image.
2. **Full hook** — title in → plan → start/end frames → Seedance clips → ElevenLabs VO → 12s/18s assemble.

Live (this product only): set after the new Railway project ships. Never overwrite the image-maker URL.

## Local

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

FFmpeg is required locally for combining multiple clips.

## Railway

Create a **new** project (example name: `hook-clip-factory`). Dockerfile installs ffmpeg. Set ContactBox, `FAL_KEY` (Seedance), ElevenLabs, R2, and auth on **that** service only. Do not commit secrets.
