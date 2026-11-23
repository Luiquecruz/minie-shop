FROM node:26-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.21.0 turbo@2.11.13

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN turbo prune @minieshop/api --docker

FROM base AS runner
WORKDIR /workspace

COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ .
RUN pnpm --filter @minieshop/contracts build \
  && pnpm --filter @minieshop/email build

WORKDIR /workspace/apps/api

EXPOSE 3001

CMD ["pnpm", "dev"]
