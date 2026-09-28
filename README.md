# Video Asset Maker

Plan and generate realistic documentary evidence stills for YouTube hooks and reveals.

Live: [video-asset-maker-production.up.railway.app](https://video-asset-maker-production.up.railway.app)

## What it does

1. Sign in (Ayush / Ali / Osi accounts via `AUTH_*_PASSWORD`)
2. Submit a title + optional script, niche, mood, and guidance
3. A background worker plans stills with the reasoning model, then generates images with GPT Image
4. Stills are stored in Cloudflare R2 and shown on a shareable job page

## Stack

- Next.js App Router
- Postgres (Prisma) — existing `jobs` / `job_assets` tables
- ContactBox reasoning (`REASONING_MODEL`)
- OpenAI GPT Image (`IMAGE_*`)
- Cloudflare R2 (`R2_*`)

## Local

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

The production database already has the schema. For a fresh local database:

```bash
npx prisma db push
```

## Railway

Project **Video Asset Maker** deploys from this repo (`railway.toml`). Required service variables are already set in production (`DATABASE_URL`, auth, image, reasoning, R2).

Health check: `GET /api/health`
