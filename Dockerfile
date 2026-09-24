# BrewCore image, following NutriCore's multi-stage layout:
#   deps → build → prod-deps → migrate (one-shot, carries the Prisma CLI)
#                            → runner  (long-running app, no Prisma CLI)
FROM node:22.19.0-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.19.0-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No secret is needed at build time: sessions are opaque random tokens.
RUN npx prisma generate && npm run build

# Production dependencies only, so the runtime image carries no build tooling.
FROM node:22.19.0-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# The migration runner: applies migrations, then upserts the bundled catalogue
# (grinders, brewers, recipes), and exits. The only image with the Prisma CLI.
FROM node:22.19.0-alpine AS migrate
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat \
 && addgroup -S brewcore -g 1001 \
 && adduser -S brewcore -u 1001 -G brewcore
COPY --from=prod-deps --chown=brewcore:brewcore /app/node_modules ./node_modules
COPY --from=prod-deps --chown=brewcore:brewcore /app/package.json ./package.json
COPY --chown=brewcore:brewcore prisma ./prisma
COPY --chown=brewcore:brewcore src/lib/catalogue ./src/lib/catalogue
COPY --chown=brewcore:brewcore docker/migrate.sh ./migrate.sh
RUN chmod +x ./migrate.sh
USER brewcore
ENTRYPOINT ["./migrate.sh"]

FROM node:22.19.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN apk add --no-cache libc6-compat wget \
 && addgroup -S brewcore -g 1001 \
 && adduser -S brewcore -u 1001 -G brewcore

COPY --from=build --chown=brewcore:brewcore /app/.next/standalone ./
COPY --from=build --chown=brewcore:brewcore /app/.next/static ./.next/static
COPY --from=build --chown=brewcore:brewcore /app/public ./public
# Overlay the production dependency tree (argon2's native build and the Prisma
# engine), then remove the Prisma CLI: it belongs only in the migrate image,
# and its transitive packages have no business in a network-facing container.
COPY --from=prod-deps --chown=brewcore:brewcore /app/node_modules ./node_modules
RUN rm -rf node_modules/prisma node_modules/@prisma/config node_modules/@prisma/engines \
           node_modules/effect node_modules/deepmerge-ts node_modules/.bin/prisma
COPY --chown=brewcore:brewcore docker/entrypoint.sh ./entrypoint.sh
COPY --chown=brewcore:brewcore docker/healthcheck.sh ./healthcheck.sh
RUN chmod +x ./entrypoint.sh ./healthcheck.sh

USER brewcore
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD ./healthcheck.sh || exit 1
ENTRYPOINT ["./entrypoint.sh"]
