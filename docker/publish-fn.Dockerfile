# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/publish-fn ./apps/publish-fn
RUN pnpm install --frozen-lockfile --filter @mailmotion/publish-fn...
RUN cd apps/publish-fn && pnpm exec tsx --version >/dev/null

FROM node:22-alpine
ENV NODE_ENV=production PORT=8788
WORKDIR /repo
RUN corepack enable
COPY --from=build /repo /repo
USER node
EXPOSE 8788
CMD ["pnpm", "--filter", "@mailmotion/publish-fn", "start"]
