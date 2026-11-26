FROM node:26-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.21.0 turbo@2.11.13

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN turbo prune @minieshop/storefront --docker

FROM base AS development
WORKDIR /workspace

COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ .
RUN pnpm exec turbo run build --filter=@minieshop/storefront^...

WORKDIR /workspace/apps/storefront

ENV DOCKER=true
EXPOSE 5199

HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=10 \
  CMD curl -fsS http://127.0.0.1:5199/ >/dev/null || exit 1

CMD ["pnpm", "exec", "vite", "--host", "0.0.0.0", "--port", "5199", "--strictPort"]

FROM development AS builder
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm build

FROM nginx:1.27-alpine AS production

COPY apps/storefront/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/storefront/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
