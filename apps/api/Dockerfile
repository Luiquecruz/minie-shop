FROM node:26-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.21.0

WORKDIR /workspace

COPY packages/config ./packages/config
COPY packages/contracts/package.json packages/contracts/pnpm-lock.yaml packages/contracts/tsconfig.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
RUN cd packages/contracts && pnpm install --frozen-lockfile && pnpm build

COPY apps/api/package.json apps/api/pnpm-lock.yaml apps/api/pnpm-workspace.yaml apps/api/tsconfig.json apps/api/eslint.config.mjs ./apps/api/
RUN cd apps/api && pnpm install --frozen-lockfile

COPY apps/api/src ./apps/api/src
COPY apps/api/drizzle ./apps/api/drizzle

WORKDIR /workspace/apps/api

EXPOSE 3001

CMD ["pnpm", "dev"]
