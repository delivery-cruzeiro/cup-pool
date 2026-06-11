FROM node:22-alpine AS base

WORKDIR /workspace

RUN corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared-types ./shared-types
COPY apps/cup-pool ./apps/cup-pool

RUN pnpm install --filter @delivery-cruzeiro/cup-pool... --frozen-lockfile

WORKDIR /workspace/apps/cup-pool

RUN pnpm run build

EXPOSE 4176

CMD ["pnpm", "run", "preview"]
