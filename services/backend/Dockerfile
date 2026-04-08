# Single-stage build — avoids pnpm version conflicts and prod-reinstall issues
FROM node:20-alpine

# Install pnpm directly via npm (no corepack, no version mismatch)
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests (layer cache for deps)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY services/backend/package.json ./services/backend/

# Install all deps (dev included — needed for NestJS decorators + reflect-metadata)
RUN pnpm install --filter @cw/backend --frozen-lockfile

# Copy source and compile
COPY services/backend/ ./services/backend/
RUN pnpm --filter @cw/backend build

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app/services/backend

EXPOSE 3000

CMD ["node", "dist/main.js"]
