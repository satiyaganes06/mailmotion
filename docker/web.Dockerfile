# syntax=docker/dockerfile:1
# Builds the static builder site, then serves it (and proxies the storage server) with Caddy.
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY docs ./docs
RUN pnpm install --frozen-lockfile --filter @mailmotion/web...
# Public build-time settings only. Secrets never go here.
ARG NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=""
ARG NEXT_PUBLIC_GITHUB_APP_SLUG=""
ARG NEXT_PUBLIC_PUBLISH_FN_URL=""
ARG NEXT_PUBLIC_ANALYTICS_SRC=""
ARG NEXT_PUBLIC_ANALYTICS_DOMAIN=""
ENV NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=$NEXT_PUBLIC_GITHUB_APP_CLIENT_ID \
    NEXT_PUBLIC_GITHUB_APP_SLUG=$NEXT_PUBLIC_GITHUB_APP_SLUG \
    NEXT_PUBLIC_PUBLISH_FN_URL=$NEXT_PUBLIC_PUBLISH_FN_URL \
    NEXT_PUBLIC_ANALYTICS_SRC=$NEXT_PUBLIC_ANALYTICS_SRC \
    NEXT_PUBLIC_ANALYTICS_DOMAIN=$NEXT_PUBLIC_ANALYTICS_DOMAIN
RUN pnpm --filter @mailmotion/web build

FROM caddy:2-alpine
COPY --from=build /repo/apps/web/out /srv
COPY docker/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
