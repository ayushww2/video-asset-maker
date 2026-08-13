# Hook clip factory

This repo is **not** the AI scenes image maker. Do **not** deploy it onto the existing Video Asset Maker Railway project.

Every job is an **18-second silent clip**. The backend always:

1. Makes **3 scenes**
2. Makes **2 frames per scene** (start + end)
3. Converts each pair into **one 6s Seedance clip**
4. Concatenates to **18s**

Providers:

- **GPT Image 2** (ContactBox) — stills on the factory path
- **Seedance 2.5** (Fal) — image-to-video
- **Not ElevenLabs.** ElevenLabs is voice-only and is not used. GPT Image and Seedance are not 11 Labs models.

Live: [hook-clip-factory-production.up.railway.app](https://hook-clip-factory-production.up.railway.app)
