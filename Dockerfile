FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "if [ \"${PRISMA_DB_PUSH_ACCEPT_DATA_LOSS:-}\" = \"1\" ]; then npx prisma db push --skip-generate --accept-data-loss; else npx prisma db push --skip-generate; fi && npm start"]
