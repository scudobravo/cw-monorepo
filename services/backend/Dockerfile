# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace manifests first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/backend/package.json ./services/backend/

# Install all deps (needed for NestJS build tooling)
RUN pnpm install --filter @cw/backend --frozen-lockfile

# Copy backend source
COPY services/backend/ ./services/backend/

# Compile TypeScript → dist/
RUN pnpm --filter @cw/backend build

# ── Stage 2: run ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/backend/package.json ./services/backend/

# Production deps only
RUN pnpm install --filter @cw/backend --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/services/backend/dist ./services/backend/dist

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app/services/backend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
