FROM node:26-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.21.0 turbo@2.11.13

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN turbo prune @minieshop/api --docker

FROM base AS development
WORKDIR /workspace

COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ .
RUN pnpm exec turbo run build --filter=@minieshop/api^...

WORKDIR /workspace/apps/api

EXPOSE 3001

CMD ["pnpm", "dev"]

FROM development AS builder
WORKDIR /workspace
RUN pnpm exec turbo run build --filter=@minieshop/api...
RUN pnpm --filter @minieshop/api --prod deploy /prod/api

FROM node:26-slim AS production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /prod/api .

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3001/health >/dev/null || exit 1

CMD ["node", "dist/main.js"]
