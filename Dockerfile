FROM node:22-slim

# better-sqlite3 ships prebuilt binaries; build-essential only needed as a fallback.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 build-essential \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["node", "server/index.js"]
