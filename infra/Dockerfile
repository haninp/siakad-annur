# syntax=docker/dockerfile:1

# Citra multi-stage untuk seluruh aplikasi SIAKAD.
#
# Satu citra dipakai bersama tiga aplikasi (dua bot dan worker); yang membedakan
# hanya perintah start-nya. Alasannya sederhana: ketiganya berbagi paket yang sama,
# dan tiga citra terpisah berarti tiga kali waktu build untuk isi yang hampir identik.
#
# Isolasi `bot-wali` TIDAK bergantung pada pemisahan citra — ia ditegakkan pada
# tingkat impor dan diverifikasi uji build (ADR 0005, 0009, 0010).

ARG VERSI_NODE=26-alpine

# ── Tahap 1: bangun ─────────────────────────────────────────────────────────
FROM node:${VERSI_NODE} AS pembangun
WORKDIR /app

# Salin manifest lebih dulu supaya lapisan npm ci ter-cache selama dependensi
# belum berubah — bukan tiap kali satu baris kode disunting.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json  packages/contracts/
COPY packages/db/package.json         packages/db/
COPY packages/core/package.json       packages/core/
COPY packages/analytics/package.json  packages/analytics/
COPY packages/drive/package.json      packages/drive/
COPY packages/bot/package.json        packages/bot/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY apps/bot-internal/package.json   apps/bot-internal/
COPY apps/bot-wali/package.json       apps/bot-wali/
COPY apps/worker/package.json         apps/worker/
RUN npm ci

COPY tsconfig.base.json tsconfig.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN npm run build

# ── Tahap 2: jalan ──────────────────────────────────────────────────────────
FROM node:${VERSI_NODE} AS jalan
WORKDIR /app

ENV NODE_ENV=production
ENV SIAKAD_DB=/data/sqlite/siakad.db

# sqlite3 CLI dipasang di citra, bukan saat container jalan. Memasang paket saat
# runtime menuntut akses jaringan dan hak root yang justru tidak ingin kita beri,
# dan hasilnya tidak dapat diulang.
RUN apk add --no-cache sqlite

# Hanya dependensi runtime. Tanpa TypeScript, eslint, atau vitest di citra akhir.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json  packages/contracts/
COPY packages/db/package.json         packages/db/
COPY packages/core/package.json       packages/core/
COPY packages/analytics/package.json  packages/analytics/
COPY packages/drive/package.json      packages/drive/
COPY packages/bot/package.json        packages/bot/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY apps/bot-internal/package.json   apps/bot-internal/
COPY apps/bot-wali/package.json       apps/bot-wali/
COPY apps/worker/package.json         apps/worker/
RUN npm ci --omit=dev

COPY --from=pembangun /app/packages/ packages/
COPY --from=pembangun /app/apps/ apps/
COPY scripts/ scripts/

# Berjalan sebagai pengguna tak-ber-hak. Direktori data dibuat dan dimiliki
# pengguna itu, karena volume yang di-mount mewarisi kepemilikan titik pasangnya.
RUN mkdir -p /data/sqlite /data/parquet /data/exports \
 && chown -R node:node /data
USER node

VOLUME ["/data"]

CMD ["node", "scripts/basis-data.ts"]
