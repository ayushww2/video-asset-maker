# Hook clip factory

This repo is **not** the AI scenes image maker. Do **not** deploy it onto the existing Video Asset Maker Railway project (`video-asset-maker-production`). That service stays as the stills generator.

This app has two studio sections:

1. **Clips only** — upload or paste a start still (end still optional) + a motion prompt → **Seedance 2.5** 6s / 480p / silent clip. No GPT Image.
2. **Full hook** — title in → plan → **GPT Image 2** start/end frames → **Seedance 2.5** clips → silent 12s/18s assemble. No ElevenLabs.

Live (this product only): [hook-clip-factory-production.up.railway.app](https://hook-clip-factory-production.up.railway.app)

The AI scenes image maker stays at `video-asset-maker-production.up.railway.app`. Do not overwrite it.

## Local

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

FFmpeg is required locally for combining multiple clips.

## Railway

Create a **new** project (example name: `hook-clip-factory`). Dockerfile installs ffmpeg. Set ContactBox (GPT Image 2 + planner), `FAL_KEY` (Seedance 2.5), R2, and auth on **that** service only. Do not commit secrets.
