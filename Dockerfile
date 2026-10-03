FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/platform/package.json apps/platform/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/providers/package.json packages/providers/package.json

RUN npm ci

COPY apps apps
COPY packages packages

RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups

# Reachable inside a container only. Put a TLS proxy in front before any public traffic.
ENV HOST=0.0.0.0
ENV PORT=8787
ENV DATABASE_DIR=/app/data
ENV BACKUP_DIR=/app/backups

USER node

EXPOSE 8787

CMD ["node", "apps/platform/src/server.ts"]
