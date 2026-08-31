# syntax=docker/dockerfile:1.7
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --chown=node:node migrations ./migrations
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src ./src

USER node
EXPOSE 3001

# Render's free plan does not support a pre-deploy command. Migrations are
# idempotent, so run them before accepting traffic on every container start.
CMD ["sh", "-c", "npm run db:migrate && exec npm start"]
