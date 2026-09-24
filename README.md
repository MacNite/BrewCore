# BrewCore

Privacy-first, self-hosted coffee brewing and tracking — the coffee-oriented
sibling of [NutriCore](https://github.com/MacNite/NutriCore).

```
Coffee → Recipe → Guided Brew → Taste → Adjust → Repeat
```

BrewCore helps you reliably reproduce good coffee: pick a coffee and a recipe,
follow a guided, timed brew (it keeps working offline once started), rate the
result, and brew it again tomorrow with every parameter carried over.

- Coffees (with optional bag photo), roasters, personal grinders on top of a
  bundled grinder catalogue, bundled and custom brewers
- Structured recipes with ordered, reorderable steps, cumulative water targets
  and deterministic dose scaling; a bundled recipe catalogue (V60, AeroPress,
  French Press, Chemex, Kalita Wave, Clever Dripper, Espresso, Moka Pot)
- Guided Live Brew: large timer, current instruction and target, next-step
  preview, pause/resume, manual or automatic step changes, sound/vibration
  cues, screen wake lock
- Brew history with snapshots (later edits never change past brews), tasting
  and rating, Brew Again, favorite coffees and recipes, JSON export
- Installable PWA; an active brew survives reloads and network loss, and its
  completion is synced exactly once when the connection returns
- English and German

The product and architecture spec is [`docs/SPEC.md`](docs/SPEC.md).

## Running with Docker Compose

Requirements: Docker with Compose v2.

```sh
cp .env.example .env
# set POSTGRES_PASSWORD (and APP_URL if not http://localhost:3000)
docker compose up -d
```

Open <http://localhost:3000> and create the first account — it becomes the
administrator. After that, sign-up closes (`REGISTRATION_MODE=bootstrap`) and
new people join through invitation links created under **Settings →
Administration**.

The stack has three services:

| Service   | What it does |
| --------- | ------------ |
| `db`      | PostgreSQL 17; not published outside the compose network; data in `POSTGRES_DATA_PATH` |
| `migrate` | one-shot: waits for the database, runs `prisma migrate deploy`, seeds the bundled catalogue, exits |
| `app`     | the BrewCore server on port `APP_PORT` (default 3000); starts only after `migrate` succeeded; health check `GET /api/health` |

Images are published to `ghcr.io/macnite/brewcore` and
`ghcr.io/macnite/brewcore-migrate` (tags: `latest`, `main`, semver, short SHA;
amd64, plus arm64 for releases). Pin **both** `APP_IMAGE` and `MIGRATE_IMAGE`
to the same tag for a reproducible deployment. `docker compose up -d --build`
builds both from source instead.

### Configuration

All variables are documented in [`.env.example`](.env.example). The important
ones:

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `POSTGRES_PASSWORD` | — (required) | database password |
| `APP_URL` | `http://localhost:3000` | public URL; `https://` marks cookies `Secure`, except for a sign-in from a browser that is itself on plain `http://` (e.g. the LAN address of an instance whose `APP_URL` is its HTTPS name), which would otherwise drop the cookie. A production start refuses a public plain-HTTP URL unless `ALLOW_INSECURE_APP_URL=true` |
| `APP_PORT` | `3000` | published port |
| `REGISTRATION_MODE` | `bootstrap` | `bootstrap` (= `invite`), `open`, `disabled` |
| `DEFAULT_LOCALE` | `de` | language for new accounts and signed-out pages (`de`/`en`) |
| `IMAGE_UPLOAD_MAX_MB` | `5` | bag photo size limit (max 15) |
| `TRUSTED_PROXY_HOPS` | `0` | reverse proxies that append `X-Forwarded-For` (for rate limiting) |

Behind a reverse proxy, terminate TLS there, set `APP_URL` to the `https://`
URL and set `TRUSTED_PROXY_HOPS` to the number of proxies (the outermost must
strip inbound `X-Forwarded-For`).

### Backups

The database directory is bind-mounted (`POSTGRES_DATA_PATH`) and a backup
directory is mounted into the `db` container at `/backups` (`BACKUP_PATH`).
Bag photos live in the database, so a database dump is a complete backup.

```sh
# Back up
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /backups/brewcore-$(date +%F).dump'

# Restore into an empty database (stop the app first)
docker compose stop app
docker compose exec db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /backups/brewcore-YYYY-MM-DD.dump'
docker compose start app
```

Schedule the backup command with the host's cron or NAS scheduler; BrewCore
has no internal backup scheduler. Every user can also download their own data
as JSON under **Settings**.

### Upgrading

```sh
docker compose pull && docker compose up -d
```

`migrate` applies new migrations and refreshes the bundled catalogue before the
new app starts. Bundled recipes are updated by key; your own recipes and copies
are never touched.

## Development

Requirements: Node.js 22, PostgreSQL 16+.

```sh
npm ci
cat > .env <<'ENV'
DATABASE_URL=postgresql://brewcore:brewcore@127.0.0.1:5432/brewcore?schema=public
TEST_DATABASE_URL=postgresql://brewcore:brewcore@127.0.0.1:5432/brewcore?schema=public
SHADOW_DATABASE_URL=postgresql://brewcore:brewcore@127.0.0.1:5432/brewcore_shadow?schema=public
APP_URL=http://localhost:3000
ENV
npx prisma generate
npm run db:migrate       # apply migrations
npm run db:seed          # bundled grinders, brewers, recipes
npm run dev              # http://localhost:3000
```

Optional demo data (development only): `SEED_PASSWORD=some-long-password npm
run db:seed:demo` creates `demo@brewcore.invalid` with example coffees.

### Checks

These are what CI runs (see `.github/workflows/ci.yml`):

```sh
npm run lint
npm run typecheck
npm test                 # unit tests; DB integration tests when TEST_DATABASE_URL is set
npx prisma validate
npm run db:drift         # schema.prisma must match the committed migrations (needs SHADOW_DATABASE_URL)
npm run db:migrate       # against a fresh database
npm run build
npm run test:e2e         # Playwright; starts the production server on port 3100
docker build -t brewcore .
docker build -t brewcore-migrate --target migrate .
```

A schema change needs a migration: `npm run db:migrate:dev -- --name <change>`.

### Layout

| Path | Contents |
| ---- | -------- |
| `src/app` | routes and page composition (App Router) |
| `src/components` | UI; `components/live` is the guided brew screen |
| `src/server` | business operations and persistence; every query is ownership-scoped |
| `src/lib/brewing` | pure domain logic: ratio, scaling, timer, state machine, recipe, tasting |
| `src/lib/offline` | IndexedDB active-brew store and completion outbox |
| `src/lib/catalogue` | bundled grinders, brewers and recipes (EN/DE) |
| `public/sw.js` | service worker |
| `prisma` | schema, migrations, seeds |
| `messages` | `en.json`, `de.json` |

## License

[AGPL-3.0-only](LICENSE).
