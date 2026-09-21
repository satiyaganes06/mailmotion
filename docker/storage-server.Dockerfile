# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/storage-server ./apps/storage-server
RUN pnpm install --frozen-lockfile --filter @mailmotion/storage-server...
RUN pnpm --filter @mailmotion/storage-server build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8787 MM_DATA_DIR=/data/files
WORKDIR /app
COPY --from=build /repo/apps/storage-server/dist/main.js ./main.js
# only needed for MM_STORAGE=s3|r2|minio
RUN npm install --no-audit --no-fund --omit=dev @aws-sdk/client-s3@^3.700.0 && mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "main.js"]
