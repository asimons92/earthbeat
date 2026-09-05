# syntax=docker/dockerfile:1

# Multi-stage build so runtime auth secrets are never declared as ARG/ENV in the image.
FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY --from=build /app /app

EXPOSE 3001

CMD ["pnpm", "start"]
