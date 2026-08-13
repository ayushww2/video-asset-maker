# Video Asset Maker

Mystery-documentary **hook factory**. Paste a title. The backend:

1. Plans a 2- or 3-scene recovered-footage hook (GPT 5.6)
2. Generates start + end frames per scene (GPT Image 2, low)
3. Scans those frames and writes I2V prompts
4. Animates each scene with **Seedance 1.5 Pro** (6s, 480p, silent)
5. Builds ElevenLabs voiceover
6. Concatenates clips on Railway into one **12s or 18s** hook
7. Uploads stills, clips, VO, and final to R2

Sized for **20–30 hooks/day**.

Live: [video-asset-maker-production.up.railway.app](https://video-asset-maker-production.up.railway.app)

## Local

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

FFmpeg is required locally for the combine step.

## Railway

Dockerfile installs ffmpeg. Set ContactBox, GPT Image, `FAL_KEY` (Seedance), ElevenLabs, and R2 on the service. Do not commit secrets.
